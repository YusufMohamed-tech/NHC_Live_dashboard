import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ERROR_MESSAGE = 'حدث خطأ في تحميل البيانات، يرجى المحاولة مجدداً'

function mapShopperRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    city: row.city,
    points: Number(row.points ?? 0),
    status: row.status ?? 'نشط',
    visits: Number(row.visits_completed ?? 0),
    createdAt: row.created_at,
  }
}

function toInsertPayload(payload) {
  return {
    name: payload.name,
    email: payload.email,
    city: payload.city,
    points: Number(payload.points ?? 0),
    status: payload.status ?? 'نشط',
    visits_completed: Number(payload.visits ?? 0),
  }
}

function toUpdatePayload(payload) {
  const updates = {}

  if (Object.hasOwn(payload, 'name')) updates.name = payload.name
  if (Object.hasOwn(payload, 'email')) updates.email = payload.email
  if (Object.hasOwn(payload, 'city')) updates.city = payload.city
  if (Object.hasOwn(payload, 'points')) updates.points = Number(payload.points ?? 0)
  if (Object.hasOwn(payload, 'status')) updates.status = payload.status
  if (Object.hasOwn(payload, 'visits')) {
    updates.visits_completed = Number(payload.visits ?? 0)
  }

  return updates
}

export default function useShoppers() {
  const [shoppers, setShoppers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchShoppers = useCallback(async () => {
    setLoading(true)

    const { data, error: fetchError } = await supabase
      .from('shoppers')
      .select('id, name, email, city, points, status, visits_completed, created_at')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(ERROR_MESSAGE)
      setLoading(false)
      return
    }

    setShoppers((data ?? []).map(mapShopperRow))
    setError('')
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchShoppers()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [fetchShoppers])

  useEffect(() => {
    const channel = supabase
      .channel(`shoppers-live-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shoppers' },
        () => {
          fetchShoppers()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchShoppers])

  const addShopper = useCallback(async (payload) => {
    const { data, error: insertError } = await supabase
      .from('shoppers')
      .insert(toInsertPayload(payload))
      .select('id, name, email, city, points, status, visits_completed, created_at')
      .single()

    if (insertError) {
      setError(ERROR_MESSAGE)
      return null
    }

    setError('')
    return mapShopperRow(data)
  }, [])

  const updateShopper = useCallback(async (shopperId, payload) => {
    const updates = toUpdatePayload(payload)

    const { data, error: updateError } = await supabase
      .from('shoppers')
      .update(updates)
      .eq('id', shopperId)
      .select('id, name, email, city, points, status, visits_completed, created_at')
      .single()

    if (updateError) {
      setError(ERROR_MESSAGE)
      return null
    }

    setError('')
    return mapShopperRow(data)
  }, [])

  const deleteShopper = useCallback(async (shopperId) => {
    const { error: deleteError } = await supabase.from('shoppers').delete().eq('id', shopperId)

    if (deleteError) {
      setError(ERROR_MESSAGE)
      return false
    }

    setError('')
    return true
  }, [])

  return {
    shoppers,
    loading,
    error,
    addShopper,
    updateShopper,
    deleteShopper,
    refreshShoppers: fetchShoppers,
  }
}
