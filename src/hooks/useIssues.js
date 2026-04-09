import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ERROR_MESSAGE = 'حدث خطأ في تحميل البيانات، يرجى المحاولة مجدداً'
const ISSUES_SELECT =
  'id, visit_id, severity, description, created_at, visits:visit_id(office_name, city, visit_date)'

function splitVisitDate(visitDate) {
  if (!visitDate) return ''

  const value = String(visitDate)
  if (value.includes('•')) {
    return value.split('•')[0].trim()
  }

  return value.slice(0, 10)
}

function mapIssueRow(row) {
  return {
    id: row.id,
    visitId: row.visit_id,
    severity: row.severity,
    description: row.description,
    date: splitVisitDate(row.visits?.visit_date),
    officeName: row.visits?.office_name ?? '',
    city: row.visits?.city ?? '',
    createdAt: row.created_at,
  }
}

export default function useIssues() {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchIssues = useCallback(async () => {
    setLoading(true)

    const { data, error: fetchError } = await supabase
      .from('issues')
      .select(ISSUES_SELECT)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(ERROR_MESSAGE)
      setLoading(false)
      return
    }

    setIssues((data ?? []).map(mapIssueRow))
    setError('')
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchIssues()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [fetchIssues])

  useEffect(() => {
    const channel = supabase
      .channel(`issues-live-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => {
          fetchIssues()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchIssues])

  const addIssue = useCallback(async (payload) => {
    const { data, error: insertError } = await supabase
      .from('issues')
      .insert({
        visit_id: payload.visitId,
        severity: payload.severity,
        description: payload.description,
      })
      .select(ISSUES_SELECT)
      .single()

    if (insertError) {
      setError(ERROR_MESSAGE)
      return null
    }

    setError('')
    return mapIssueRow(data)
  }, [])

  return {
    issues,
    loading,
    error,
    addIssue,
    refreshIssues: fetchIssues,
  }
}
