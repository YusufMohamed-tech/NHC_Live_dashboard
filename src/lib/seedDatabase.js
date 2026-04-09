import { shoppers as mockShoppers, visits as mockVisits } from '../data/mockData'
import { supabase } from './supabase'

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

function getIssueKey(visitId, severity, description) {
  return `${visitId}|${severity}|${description}`
}

export async function seedDatabase() {
  const { data: existingShoppers, error: shoppersError } = await supabase
    .from('shoppers')
    .select('id, email')

  if (shoppersError) {
    throw shoppersError
  }

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
    const { data, error: insertShoppersError } = await supabase
      .from('shoppers')
      .insert(shoppersToInsert)
      .select('id, email')

    if (insertShoppersError) {
      throw insertShoppersError
    }

    insertedShoppers = data ?? []
    insertedShoppers.forEach((shopper) => {
      shoppersByEmail.set(shopper.email, shopper.id)
    })
  }

  const shopperIdMap = new Map()

  mockShoppers.forEach((mockShopper) => {
    const shopperId = shoppersByEmail.get(mockShopper.email)
    if (shopperId) {
      shopperIdMap.set(mockShopper.id, shopperId)
    }
  })

  const { data: existingVisits, error: visitsError } = await supabase
    .from('visits')
    .select('id, membership_id')

  if (visitsError) {
    throw visitsError
  }

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
    const { data, error: insertVisitsError } = await supabase
      .from('visits')
      .insert(visitsToInsert)
      .select('id, membership_id')

    if (insertVisitsError) {
      throw insertVisitsError
    }

    insertedVisits = data ?? []
    insertedVisits.forEach((visit) => {
      visitsByMembership.set(visit.membership_id, visit.id)
    })
  }

  const { data: existingIssues, error: issuesReadError } = await supabase
    .from('issues')
    .select('visit_id, severity, description')

  if (issuesReadError) {
    throw issuesReadError
  }

  const issueSet = new Set(
    (existingIssues ?? []).map((issue) =>
      getIssueKey(issue.visit_id, issue.severity, issue.description),
    ),
  )

  const issueRows = mockVisits.flatMap((visit) => {
    const linkedVisitId = visitsByMembership.get(visit.membershipId)

    if (!linkedVisitId) {
      return []
    }

    return (visit.issues ?? []).flatMap((issue) => {
      const key = getIssueKey(linkedVisitId, issue.severity, issue.description)

      if (issueSet.has(key)) {
        return []
      }

      issueSet.add(key)

      return {
        visit_id: linkedVisitId,
        severity: issue.severity,
        description: issue.description,
      }
    })
  })

  if (issueRows.length > 0) {
    const { error: issuesInsertError } = await supabase.from('issues').insert(issueRows)
    if (issuesInsertError) {
      throw issuesInsertError
    }
  }

  const inserted =
    insertedShoppers.length > 0 || insertedVisits.length > 0 || issueRows.length > 0

  if (!inserted) {
    return { inserted: false, reason: 'up-to-date' }
  }

  return {
    inserted,
    shoppers: insertedShoppers.length,
    visits: insertedVisits.length,
    issues: issueRows.length,
  }
}
