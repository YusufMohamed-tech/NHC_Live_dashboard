import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ERROR_MESSAGE = 'حدث خطأ في تحميل البيانات، يرجى المحاولة مجدداً'
const VISITS_SELECT =
  'id, office_name, city, status, scenario, membership_id, shopper_id, visit_date, scores, notes, points_earned, file_urls, created_at, shoppers:shopper_id(name)'

function normalizeTimeLabel(value) {
  if (!value) return '10:00 صباحاً'

  if (value.includes('صباحاً') || value.includes('مساءً')) {
    return value
  }

  return value
    .replace(/\s?ص\.?$/u, ' صباحاً')
    .replace(/\s?م\.?$/u, ' مساءً')
}

function to24HourTime(timeLabel) {
  const normalized = normalizeTimeLabel(timeLabel)
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(صباحاً|مساءً)?/u)

  if (!match) {
    return '10:00'
  }

  let hour = Number(match[1])
  const minute = match[2]
  const period = match[3] ?? 'صباحاً'

  if (period === 'مساءً' && hour < 12) {
    hour += 12
  }

  if (period === 'صباحاً' && hour === 12) {
    hour = 0
  }

  return `${String(hour).padStart(2, '0')}:${minute}`
}

function splitVisitDateTime(visitDate) {
  if (!visitDate) {
    return { date: '', time: '10:00 صباحاً' }
  }

  const value = String(visitDate)

  if (value.includes('•')) {
    const [datePart, timePart] = value.split('•')
    return {
      date: datePart.trim(),
      time: normalizeTimeLabel((timePart ?? '').trim()),
    }
  }

  if (value.includes('T')) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      const date = parsed.toISOString().slice(0, 10)
      const rawTime = parsed.toLocaleTimeString('ar-SA-u-nu-latn', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      return { date, time: normalizeTimeLabel(rawTime) }
    }
  }

  return { date: value.slice(0, 10), time: '10:00 صباحاً' }
}

function buildVisitDate(date, time) {
  const safeDate = date || new Date().toISOString().slice(0, 10)
  const hhmm = to24HourTime(time || '10:00 صباحاً')
  return `${safeDate}T${hhmm}:00`
}

function mapVisitRow(row) {
  const dateParts = splitVisitDateTime(row.visit_date)

  return {
    id: row.id,
    officeName: row.office_name,
    city: row.city,
    type: 'مكتب مبيعات',
    date: dateParts.date,
    time: dateParts.time,
    status: row.status,
    scenario: row.scenario,
    membershipId: row.membership_id,
    assignedShopperId: row.shopper_id,
    assignedShopperName: row.shoppers?.name ?? '',
    scores: row.scores ?? {},
    notes: row.notes ?? '',
    // file_urls is stored as text[] in Postgres; expose as JS array of strings
    fileUrls: Array.isArray(row.file_urls) ? row.file_urls : [],
    pointsEarned: Number(row.points_earned ?? 0),
    waitMinutes: 0,
    createdAt: row.created_at,
    issues: [],
  }
}

function buildInsertPayload(payload) {
  return {
    office_name: payload.officeName,
    city: payload.city,
    status: payload.status,
    scenario: payload.scenario,
    membership_id: payload.membershipId,
    shopper_id: payload.assignedShopperId || null,
    visit_date: buildVisitDate(payload.date, payload.time),
    scores: payload.scores ?? {},
    notes: payload.notes ?? '',
    points_earned: Number(payload.pointsEarned ?? 0),
  }
}

function buildUpdatePayload(previousVisit, updates) {
  const payload = {}

  if (Object.hasOwn(updates, 'officeName')) payload.office_name = updates.officeName
  if (Object.hasOwn(updates, 'city')) payload.city = updates.city
  if (Object.hasOwn(updates, 'status')) payload.status = updates.status
  if (Object.hasOwn(updates, 'scenario')) payload.scenario = updates.scenario
  if (Object.hasOwn(updates, 'membershipId')) payload.membership_id = updates.membershipId
  if (Object.hasOwn(updates, 'assignedShopperId')) {
    payload.shopper_id = updates.assignedShopperId || null
  }
  if (Object.hasOwn(updates, 'scores')) payload.scores = updates.scores
  if (Object.hasOwn(updates, 'notes')) payload.notes = updates.notes
  if (Object.hasOwn(updates, 'pointsEarned')) {
    payload.points_earned = Number(updates.pointsEarned ?? 0)
  }

  if (Object.hasOwn(updates, 'date') || Object.hasOwn(updates, 'time')) {
    const date = Object.hasOwn(updates, 'date') ? updates.date : previousVisit?.date
    const time = Object.hasOwn(updates, 'time') ? updates.time : previousVisit?.time
    payload.visit_date = buildVisitDate(date, time)
  }

  return payload
}

async function syncShopperProgress(previousVisit, updatedVisit) {
  if (!updatedVisit.assignedShopperId) {
    return
  }

  if (updatedVisit.status !== 'مكتملة') {
    return
  }

  const wasCompleted = previousVisit?.status === 'مكتملة'
  const previousPoints = Number(previousVisit?.pointsEarned ?? 0)
  const nextPoints = Number(updatedVisit.pointsEarned ?? 0)

  const pointsDelta = wasCompleted ? nextPoints - previousPoints : nextPoints
  const visitsDelta = wasCompleted ? 0 : 1

  if (pointsDelta === 0 && visitsDelta === 0) {
    return
  }

  const { data: shopper, error: shopperError } = await supabase
    .from('shoppers')
    .select('id, points, visits_completed')
    .eq('id', updatedVisit.assignedShopperId)
    .single()

  if (shopperError || !shopper) {
    return
  }

  await supabase
    .from('shoppers')
    .update({
      points: Math.max(0, Number(shopper.points ?? 0) + pointsDelta),
      visits_completed: Math.max(0, Number(shopper.visits_completed ?? 0) + visitsDelta),
    })
    .eq('id', shopper.id)
}

export default function useVisits() {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchVisits = useCallback(async () => {
    setLoading(true)

    const { data, error: fetchError } = await supabase
      .from('visits')
      .select(VISITS_SELECT)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(ERROR_MESSAGE)
      setLoading(false)
      return
    }

    setVisits((data ?? []).map(mapVisitRow))
    setError('')
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchVisits()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [fetchVisits])

  useEffect(() => {
    const channel = supabase
      .channel(`visits-live-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        () => {
          fetchVisits()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchVisits])

  const addVisit = useCallback(async (payload) => {
    // Insert visit row first (without files). Files will be uploaded to storage
    // and the visit updated with file URLs afterwards.
    const { data, error: insertError } = await supabase
      .from('visits')
      .insert(buildInsertPayload(payload))
      .select(VISITS_SELECT)
      .single()

    if (insertError || !data) {
      setError(ERROR_MESSAGE)
      return null
    }

    let mapped = mapVisitRow(data)

    // If files were provided, upload them to the 'visit-files' bucket and
    // update the visit.row.file_urls with the public URLs.
    try {
      if (payload.files && payload.files.length > 0) {
        const uploadedUrls = []

        // upload each file to Google Drive via the backend API
        for (const file of payload.files) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('call_id', data.id)

            const response = await fetch('/api/upload-call', {
              method: 'POST',
              body: formData,
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
              console.warn('visit file upload failed', result.error || result)
              continue
            }

            if (result.url) uploadedUrls.push(result.url)
          } catch (err) {
            console.warn('upload error', err)
          }
        }

        if (uploadedUrls.length > 0) {
          // update visit row with file URLs
          const { data: updated, error: updateError } = await supabase
            .from('visits')
            .update({ file_urls: uploadedUrls })
            .eq('id', data.id)
            .select(VISITS_SELECT)
            .single()

          if (!updateError && updated) {
            mapped = mapVisitRow(updated)
          }
        }
      }
    } catch (err) {
      // swallow upload errors but log for debugging
      console.warn('file upload process failed', err)
    }

    await syncShopperProgress(null, mapped)
    setError('')
    return mapped
  }, [])

  const updateVisit = useCallback(async (visitId, updates) => {
    const previousVisit = visits.find((visit) => String(visit.id) === String(visitId))
    const payload = buildUpdatePayload(previousVisit, updates)

    const { data, error: updateError } = await supabase
      .from('visits')
      .update(payload)
      .eq('id', visitId)
      .select(VISITS_SELECT)
      .single()

    if (updateError) {
      setError(ERROR_MESSAGE)
      return null
    }

    const mapped = mapVisitRow(data)
    await syncShopperProgress(previousVisit, mapped)
    setError('')
    return mapped
  }, [visits])

  const deleteVisit = useCallback(async (visitId) => {
    const { error: deleteError } = await supabase.from('visits').delete().eq('id', visitId)

    if (deleteError) {
      setError(ERROR_MESSAGE)
      return false
    }

    setError('')
    return true
  }, [])

  return {
    visits,
    loading,
    error,
    addVisit,
    updateVisit,
    deleteVisit,
    refreshVisits: fetchVisits,
  }
}
