import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { shoppers as mockShoppers, visits as mockVisits } from '../src/data/mockData.js'

function readEnv() {
  const lines = fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))

  const env = {}

  for (const line of lines) {
    const index = line.indexOf('=')
    if (index > 0) {
      env[line.slice(0, index)] = line.slice(index + 1)
    }
  }

  return env
}

function toVisitDate(date, time) {
  const match = String(time ?? '10:00 صباحاً').match(
    /(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?/u,
  )

  let hour = 10
  let minute = '00'
  let period = 'صباحاً'

  if (match) {
    hour = Number(match[1])
    minute = match[2]
    period = match[3] ?? 'صباحاً'
  }

  if (period === 'مساءً' && hour < 12) {
    hour += 12
  }

  if (period === 'صباحاً' && hour === 12) {
    hour = 0
  }

  return `${date}T${String(hour).padStart(2, '0')}:${minute}:00`
}

function issueKey(visitId, severity, description) {
  return `${visitId}|${severity}|${description}`
}

async function run() {
  const env = readEnv()
  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

  const { data: existingShoppers, error: shoppersError } = await supabase
    .from('shoppers')
    .select('id, email')

  if (shoppersError) throw shoppersError

  const shoppersByEmail = new Map(
    (existingShoppers ?? []).map((shopper) => [shopper.email, shopper.id]),
  )

  const shoppersToInsert = mockShoppers
    .filter((shopper) => !shoppersByEmail.has(shopper.email))
    .map((shopper) => ({
      name: shopper.name,
      email: shopper.email,
      city: shopper.city,
      points: shopper.points,
      status: shopper.status,
      visits_completed: shopper.visits,
    }))

  let insertedShoppers = []

  if (shoppersToInsert.length > 0) {
    const { data, error } = await supabase
      .from('shoppers')
      .insert(shoppersToInsert)
      .select('id, email')

    if (error) throw error

    insertedShoppers = data ?? []
    insertedShoppers.forEach((shopper) => {
      shoppersByEmail.set(shopper.email, shopper.id)
    })
  }

  const shopperIdMap = new Map()

  mockShoppers.forEach((shopper) => {
    const id = shoppersByEmail.get(shopper.email)
    if (id) {
      shopperIdMap.set(shopper.id, id)
    }
  })

  const { data: existingVisits, error: visitsReadError } = await supabase
    .from('visits')
    .select('id, membership_id')

  if (visitsReadError) throw visitsReadError

  const visitsByMembership = new Map(
    (existingVisits ?? []).map((visit) => [visit.membership_id, visit.id]),
  )

  const visitsToInsert = mockVisits
    .filter((visit) => !visitsByMembership.has(visit.membershipId))
    .map((visit) => ({
      office_name: visit.officeName,
      city: visit.city,
      status: visit.status,
      scenario: visit.scenario,
      membership_id: visit.membershipId,
      shopper_id: shopperIdMap.get(visit.assignedShopperId) ?? null,
      visit_date: toVisitDate(visit.date, visit.time),
      scores: visit.scores,
      notes: visit.notes,
      points_earned: visit.pointsEarned,
    }))

  let insertedVisits = []

  if (visitsToInsert.length > 0) {
    const { data, error } = await supabase
      .from('visits')
      .insert(visitsToInsert)
      .select('id, membership_id')

    if (error) throw error

    insertedVisits = data ?? []
    insertedVisits.forEach((visit) => {
      visitsByMembership.set(visit.membership_id, visit.id)
    })
  }

  const { data: existingIssues, error: issuesReadError } = await supabase
    .from('issues')
    .select('visit_id, severity, description')

  if (issuesReadError) throw issuesReadError

  const existingIssueSet = new Set(
    (existingIssues ?? []).map((issue) =>
      issueKey(issue.visit_id, issue.severity, issue.description),
    ),
  )

  const issuesToInsert = mockVisits.flatMap((visit) => {
    const visitId = visitsByMembership.get(visit.membershipId)
    if (!visitId) return []

    return (visit.issues ?? []).flatMap((issue) => {
      const key = issueKey(visitId, issue.severity, issue.description)
      if (existingIssueSet.has(key)) return []
      existingIssueSet.add(key)

      return {
        visit_id: visitId,
        severity: issue.severity,
        description: issue.description,
      }
    })
  })

  let insertedIssues = 0

  if (issuesToInsert.length > 0) {
    const { error } = await supabase.from('issues').insert(issuesToInsert)
    if (error) throw error
    insertedIssues = issuesToInsert.length
  }

  console.log(
    JSON.stringify(
      {
        insertedShoppers: insertedShoppers.length,
        insertedVisits: insertedVisits.length,
        insertedIssues,
      },
      null,
      2,
    ),
  )
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
