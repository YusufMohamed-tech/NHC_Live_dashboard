import { useMemo, useState, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import {
  evaluationCriteria,
  issues as initialIssues,
  offices,
  pointsRules,
  shoppers as initialShoppers,
  subAdmins as initialSubAdmins,
  visits as initialVisits,
} from './data/mockData'
import { supabase } from './lib/supabase'

function usePersistentState(key, initialValue) {
  // 1. LocalStorage initial sync to prevent UI flickering
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  // 2. Fetch fresh data from Supabase once on mount
  useEffect(() => {
    let active = true
    async function fetchFromSupabase() {
      try {
        const { data, error } = await supabase
          .from('app_state')
          .select('data')
          .eq('id', key)
          .single()

        if (!error && data?.data && active) {
          setState(data.data) // Override local storage immediately if Supabase has data
        }
      } catch (err) {
        console.warn(`Supabase load error for ${key}:`, err.message)
      }
    }
    fetchFromSupabase()
    
    return () => {
      active = false
    }
  }, [key])

  // 3. Sync to both LocalStorage and Supabase automatically on any change
  useEffect(() => {
    // Save to local storage for instant continuity (backup)
    window.localStorage.setItem(key, JSON.stringify(state))

    // Save to Supabase (Debounced 800ms to avoid slamming API on typings)
    const timeoutId = setTimeout(async () => {
      try {
        await supabase
          .from('app_state')
          .upsert({ id: key, data: state })
      } catch (err) {
        console.warn(`Supabase save error for ${key}:`, err.message)
      }
    }, 800)

    return () => clearTimeout(timeoutId)
  }, [key, state])

  return [state, setState]
}
import Login from './pages/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Overview from './pages/admin/Overview'
import Shoppers from './pages/admin/Shoppers'
import Visits from './pages/admin/Visits'
import AdminReports from './pages/admin/Reports'
import Points from './pages/admin/Points'
import ShopperLayout from './pages/shopper/ShopperLayout'
import ShopperDashboard from './pages/shopper/Dashboard'
import MyVisits from './pages/shopper/MyVisits'
import VisitDetail from './pages/shopper/VisitDetail'
import CompletedVisits from './pages/shopper/CompletedVisits'
import ShopperReports from './pages/shopper/Reports'
import SuperAdminLayout from './pages/superadmin/SuperAdminLayout'
import SuperAdminOverview from './pages/superadmin/Overview'
import ManageAdmins from './pages/superadmin/ManageAdmins'
import { calculateWeightedScore } from './utils/scoring'
import { calculateVisitPoints } from './utils/points'
import { getFilePointsFromPath, normalizeVisitFileUrls } from './utils/visitFiles'

const AUTH_STORAGE_KEY = 'nhc-mystery-auth'

const SUPER_ADMIN_ACCOUNT = {
  id: 'superadmin-root',
  name: 'المدير العام',
  email: 'superadmin@nhc.sa',
  password: 'super123',
  role: 'superadmin',
}

function getRoleHome(role) {
  if (role === 'superadmin') return '/superadmin/overview'
  if (role === 'admin') return '/admin/overview'
  if (role === 'shopper') return '/shopper/dashboard'
  return '/'
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function generateMembershipId() {
  return `NHC-${Math.floor(10000 + Math.random() * 90000)}`
}

function makeEmptyScores(criteria) {
  return criteria.reduce((accumulator, criterion) => {
    accumulator[criterion.key] = 0
    return accumulator
  }, {})
}

function getGeneratedIssues(scores, criteria) {
  const weakCriteria = criteria.filter(
    (criterion) => Number(scores[criterion.key] ?? 0) <= 2,
  )

  if (weakCriteria.length === 0) {
    return []
  }

  const severity =
    weakCriteria.length >= 3 ? 'خطيرة' : weakCriteria.length === 2 ? 'متوسطة' : 'بسيطة'

  return [
    {
      id: makeId('issue'),
      severity,
      description: `تم رصد انخفاض في معيار ${weakCriteria[0].label}.`,
    },
  ]
}

function ProtectedRoute({ user, allowedRole, children }) {
  if (!user) {
    return <Navigate to="/" replace />
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={getRoleHome(user.role)} replace />
  }

  return children
}

function App() {
  const [subAdmins, setSubAdmins] = useState([])
  const [shoppers, setShoppers] = useState([])
  const [visits, setVisits] = useState([])
  const [issues, setIssues] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')

  // 1. Fetch real structured data from Supabase
  useEffect(() => {
    let mounted = true
    async function fetchCoreData() {
      try {
        setDataLoading(true)
        setDataError('')

        const [
          { data: adminsData, error: adminsError },
          { data: shoppersData, error: shoppersError },
          { data: visitsData, error: visitsError },
          { data: issuesData, error: issuesError }
        ] = await Promise.all([
          supabase.from('admins').select('*'),
          supabase.from('shoppers').select('*'),
          supabase.from('visits').select('*'),
          supabase.from('issues').select('*')
        ])

        if (adminsError) throw adminsError
        if (shoppersError) throw shoppersError
        if (visitsError) throw visitsError
        if (issuesError) throw issuesError

        if (mounted) {
          // Filter to match the previous structure expectation
          setSubAdmins(adminsData.filter(a => a.role === 'admin') || [])
          setShoppers(shoppersData || [])
          setVisits(visitsData || [])
          setIssues(issuesData || [])
        }
      } catch (err) {
        console.error('Failed to load application data:', err)
        if (mounted) {
          setDataError('فشل الاتصال بقاعدة البيانات. يرجى التأكد من الإعدادات.')
        }
      } finally {
        if (mounted) setDataLoading(false)
      }
    }

    fetchCoreData()

    return () => {
      mounted = false
    }
  }, [])

  const [authUser, setAuthUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const activeUser = useMemo(() => {
    if (!authUser) return null

    if (authUser.role === 'superadmin') {
      return {
        ...authUser,
        role: 'superadmin',
      }
    }

    if (authUser.role === 'admin') {
      const subAdmin = subAdmins.find(
        (item) => item.id === authUser.id || normalizeEmail(item.email) === normalizeEmail(authUser.email),
      )

      if (!subAdmin) {
        return null
      }

      return {
        ...authUser,
        ...subAdmin,
        role: 'admin',
        assignedShopperIds: subAdmin.assignedShopperIds ?? [],
      }
    }

    if (authUser.role === 'shopper') {
      const shopper = shoppers.find(
        (item) => item.id === authUser.id || normalizeEmail(item.email) === normalizeEmail(authUser.email),
      )

      if (!shopper) {
        return null
      }

      return {
        ...authUser,
        ...shopper,
        role: 'shopper',
      }
    }

    return null
  }, [authUser, shoppers, subAdmins])

  const issuesByVisit = useMemo(() => {
    const map = new Map()

    issues.forEach((issue) => {
      const current = map.get(issue.visitId) ?? []
      map.set(issue.visitId, [...current, issue])
    })

    return map
  }, [issues])

  const visitsWithIssues = useMemo(() => {
    return visits.map((visit) => ({
      ...visit,
      issues: issuesByVisit.get(visit.id) ?? [],
    }))
  }, [issuesByVisit, visits])

  const assignedShopperIds = useMemo(() => {
    if (activeUser?.role !== 'admin') return []
    return activeUser.assignedShopperIds ?? []
  }, [activeUser])

  const scopedShoppers = useMemo(() => {
    if (activeUser?.role !== 'admin') return shoppers
    return shoppers.filter((shopper) => assignedShopperIds.includes(shopper.id))
  }, [activeUser, assignedShopperIds, shoppers])

  const scopedVisits = useMemo(() => {
    if (activeUser?.role !== 'admin') return visitsWithIssues
    return visitsWithIssues.filter((visit) => assignedShopperIds.includes(visit.assignedShopperId))
  }, [activeUser, assignedShopperIds, visitsWithIssues])

  const scopedIssues = useMemo(() => {
    if (activeUser?.role !== 'admin') return issues

    const scopedVisitIds = new Set(scopedVisits.map((visit) => visit.id))
    return issues.filter((issue) => scopedVisitIds.has(issue.visitId))
  }, [activeUser, issues, scopedVisits])

  const dataLoadingValue = dataLoading // Rename variable slightly to avoid naming conflict
  const dataErrorValue = dataError // Rename variable slightly

  const canManageShopper = (shopperId) => {
    if (!activeUser) return false
    if (activeUser.role === 'superadmin') return true
    if (activeUser.role === 'admin') {
      return (activeUser.assignedShopperIds ?? []).includes(shopperId)
    }
    return false
  }

  const canManageVisit = (visit) => {
    if (!activeUser || !visit) return false
    if (activeUser.role === 'superadmin') return true
    if (activeUser.role === 'admin') {
      return (activeUser.assignedShopperIds ?? []).includes(visit.assignedShopperId)
    }
    return false
  }

  const handleLogin = (email, password) => {
    const normalizedEmail = normalizeEmail(email)

    if (
      normalizedEmail === SUPER_ADMIN_ACCOUNT.email &&
      password === SUPER_ADMIN_ACCOUNT.password
    ) {
      const payload = {
        id: SUPER_ADMIN_ACCOUNT.id,
        name: SUPER_ADMIN_ACCOUNT.name,
        email: SUPER_ADMIN_ACCOUNT.email,
        role: 'superadmin',
      }

      setAuthUser(payload)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      return payload
    }

    const subAdmin = subAdmins.find(
      (item) =>
        normalizeEmail(item.email) === normalizedEmail &&
        item.password === password &&
        item.status === 'نشط',
    )

    if (subAdmin) {
      const payload = {
        id: subAdmin.id,
        name: subAdmin.name,
        email: subAdmin.email,
        role: 'admin',
        assignedShopperIds: subAdmin.assignedShopperIds ?? [],
      }

      setAuthUser(payload)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      return payload
    }

    const shopper = shoppers.find(
      (item) =>
        normalizeEmail(item.email) === normalizedEmail &&
        item.password === password &&
        item.status === 'نشط',
    )

    if (shopper) {
      const payload = {
        id: shopper.id,
        name: shopper.name,
        email: shopper.email,
        role: 'shopper',
      }

      setAuthUser(payload)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      return payload
    }

    return null
  }

  const handleLogout = () => {
    setAuthUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const addSubAdmin = async (payload) => {
    if (activeUser?.role !== 'superadmin') return null

    const assignedSet = new Set(payload.assignedShopperIds ?? [])
    const validAssigned = shoppers
      .filter((shopper) => assignedSet.has(shopper.id))
      .map((shopper) => shopper.id)

    const nextSubAdmin = {
      id: makeId('admin'),
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      password: payload.password,
      city: payload.city.trim(),
      status: payload.status ?? 'نشط',
      assignedShopperIds: validAssigned,
    }

    setSubAdmins((previous) => [nextSubAdmin, ...previous])
    return nextSubAdmin
  }

  const updateSubAdmin = async (subAdminId, updates) => {
    if (activeUser?.role !== 'superadmin') return null

    let updatedItem = null

    setSubAdmins((previous) =>
      previous.map((item) => {
        if (item.id !== subAdminId) return item

        const assignedSet = new Set(updates.assignedShopperIds ?? item.assignedShopperIds ?? [])
        const validAssigned = shoppers
          .filter((shopper) => assignedSet.has(shopper.id))
          .map((shopper) => shopper.id)

        updatedItem = {
          ...item,
          ...updates,
          email: updates.email ? normalizeEmail(updates.email) : item.email,
          name: updates.name ? updates.name.trim() : item.name,
          city: updates.city ? updates.city.trim() : item.city,
          assignedShopperIds: validAssigned,
        }

        return updatedItem
      }),
    )

    if (updatedItem && authUser?.role === 'admin' && authUser.id === subAdminId) {
      const refreshedAuth = {
        ...authUser,
        ...updatedItem,
        role: 'admin',
      }
      setAuthUser(refreshedAuth)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedAuth))
    }

    return updatedItem
  }

  const deleteSubAdmin = async (subAdminId) => {
    if (activeUser?.role !== 'superadmin') return false

    const { error } = await supabase.from('admins').delete().eq('id', subAdminId)
    if (error) {
      console.error('Error deleting admin:', error)
      return false
    }

    setSubAdmins((previous) => previous.filter((item) => item.id !== subAdminId))

    if (authUser?.role === 'admin' && authUser.id === subAdminId) {
      handleLogout()
    }

    return true
  }

  const assignSubAdminShoppers = async (subAdminId, assignedIds) => {
    return updateSubAdmin(subAdminId, {
      assignedShopperIds: assignedIds,
    })
  }

  const addShopper = async (payload) => {
    if (!activeUser || !['superadmin', 'admin'].includes(activeUser.role)) {
      return null
    }

    const dbStatus = (payload.status === 'نشط' || payload.status === 'active') ? 'active' : 'inactive'

    const assignedAdminId = activeUser.role === 'admin' ? activeUser.id : null

    const newShopperData = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      password: payload.password,
      city: payload.city.trim(),
      visits_completed: 0,
      points: 0,
      status: dbStatus,
      assigned_admin_id: assignedAdminId
    }

    const { data: dbShopper, error } = await supabase
      .from('shoppers')
      .insert([newShopperData])
      .select()
      .single()

    if (error || !dbShopper) {
      console.error('Error adding shopper:', error)
      return null
    }

    const nextShopper = {
      ...dbShopper,
      status: dbShopper.status === 'active' ? 'نشط' : 'غير نشط',
      visits: dbShopper.visits_completed
    }

    setShoppers((previous) => [nextShopper, ...previous])

    if (activeUser.role === 'admin') {
      setSubAdmins((previous) =>
        previous.map((item) => {
          if (item.id !== activeUser.id) return item
          const assigned = new Set(item.assignedShopperIds ?? [])
          assigned.add(nextShopper.id)
          return {
            ...item,
            assignedShopperIds: Array.from(assigned),
          }
        }),
      )
      
      // Update admin in db too
      const currentAdmin = subAdmins.find(a => a.id === activeUser.id)
      if (currentAdmin) {
        const assigned = new Set(currentAdmin.assignedShopperIds ?? [])
        assigned.add(nextShopper.id)
        await supabase.from('admins').update({ assigned_shopper_ids: Array.from(assigned) }).eq('id', activeUser.id)
      }
    }

    return nextShopper
  }

  const updateShopper = async (shopperId, updates) => {
    if (!canManageShopper(shopperId)) return null

    let dbUpdates = {}
    if (updates.name) dbUpdates.name = updates.name.trim()
    if (updates.email) dbUpdates.email = normalizeEmail(updates.email)
    if (updates.city) dbUpdates.city = updates.city.trim()
    if (updates.password) dbUpdates.password = updates.password
    if (updates.status) {
      dbUpdates.status = (updates.status === 'نشط' || updates.status === 'active') ? 'active' : 'inactive'
    }

    const { data: dbShopper, error } = await supabase
      .from('shoppers')
      .update(dbUpdates)
      .eq('id', shopperId)
      .select()
      .single()

    if (error || !dbShopper) {
      console.error('Error updating shopper:', error)
      return null
    }

    const nextShopper = {
      ...dbShopper,
      status: dbShopper.status === 'active' ? 'نشط' : 'غير نشط',
      visits: dbShopper.visits_completed
    }

    setShoppers((previous) =>
      previous.map((item) => (item.id === shopperId ? nextShopper : item))
    )

    if (nextShopper && authUser?.role === 'shopper' && authUser.id === shopperId) {
      const refreshedAuth = {
        ...authUser,
        ...nextShopper,
        role: 'shopper',
      }
      setAuthUser(refreshedAuth)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedAuth))
    }

    return nextShopper
  }

  const updateShopperStatus = async (shopperId, status) => {
    return updateShopper(shopperId, { status })
  }

  const deleteShopper = async (shopperId) => {
    if (!canManageShopper(shopperId)) return false

    const { error } = await supabase.from('shoppers').delete().eq('id', shopperId)
    if (error) {
      console.error('Error deleting shopper:', error)
      return false
    }

    setShoppers((previous) => previous.filter((item) => item.id !== shopperId))

    setSubAdmins((previous) =>
      previous.map((item) => ({
        ...item,
        assignedShopperIds: (item.assignedShopperIds ?? []).filter((id) => id !== shopperId),
      })),
    )

    setVisits((previous) => previous.filter((visit) => visit.assignedShopperId !== shopperId))

    setIssues((previous) => {
      const remainingVisitIds = new Set(
        visits
          .filter((visit) => visit.assignedShopperId !== shopperId)
          .map((visit) => visit.id),
      )

      return previous.filter((issue) => remainingVisitIds.has(issue.visitId))
    })

    if (authUser?.role === 'shopper' && authUser.id === shopperId) {
      handleLogout()
    }

    return true
  }

  const addVisit = async (payload) => {
    if (!activeUser || !['superadmin', 'admin'].includes(activeUser.role)) return null
    if (!payload.assignedShopperId || !canManageShopper(payload.assignedShopperId)) return null

    const dbPayload = {
      office_name: payload.officeName.trim(),
      city: payload.city.trim(),
      type: payload.type ?? 'مكتب مبيعات',
      status: payload.status ?? 'معلقة',
      scenario: payload.scenario?.trim() ?? '',
      membership_id: payload.membershipId?.trim() || generateMembershipId(),
      shopper_id: payload.assignedShopperId,
      visit_date: payload.date ? new Date(`${payload.date}T${payload.time || '00:00'}:00`).toISOString() : new Date().toISOString(),
      scores: payload.scores ?? makeEmptyScores(evaluationCriteria),
      notes: payload.notes ?? '',
      points_earned: payload.pointsEarned ?? 0
    }

    const { data: dbVisit, error } = await supabase.from('visits').insert([dbPayload]).select().single()
    if (error || !dbVisit) {
      console.error('Error adding visit:', error)
      return null
    }

    const nextVisit = {
      ...dbVisit,
      id: dbVisit.id,
      officeName: dbVisit.office_name,
      assignedShopperId: dbVisit.shopper_id,
      membershipId: dbVisit.membership_id,
      pointsEarned: dbVisit.points_earned,
      type: dbVisit.type,
      status: dbVisit.status,
      scenario: dbVisit.scenario,
      city: dbVisit.city,
      notes: dbVisit.notes,
      scores: dbVisit.scores,
      waitMinutes: 0,
      file_urls: payload.file_urls ?? []
    }

    setVisits((previous) => [nextVisit, ...previous])
    return nextVisit
  }

  const updateVisit = async (visitId, updates) => {
    if (!activeUser || !['superadmin', 'admin', 'shopper'].includes(activeUser.role)) return null

    let dbUpdates = {}
    if (updates.officeName !== undefined) dbUpdates.office_name = updates.officeName.trim()
    if (updates.city !== undefined) dbUpdates.city = updates.city.trim()
    if (updates.type !== undefined) dbUpdates.type = updates.type
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.scenario !== undefined) dbUpdates.scenario = updates.scenario.trim()
    if (updates.membershipId !== undefined) dbUpdates.membership_id = updates.membershipId.trim()
    if (updates.scores !== undefined) dbUpdates.scores = updates.scores
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes
    if (updates.pointsEarned !== undefined) dbUpdates.points_earned = updates.pointsEarned

    const { data: dbVisit, error } = await supabase.from('visits').update(dbUpdates).eq('id', visitId).select().single()
    if (error || !dbVisit) {
      console.error('Error updating visit:', error)
      return null
    }

    let updatedVisit = null

    setVisits((previous) =>
      previous.map((visit) => {
        if (visit.id !== visitId) return visit
        if (!canManageVisit(visit) && authUser?.role !== 'shopper') return visit

        updatedVisit = {
          ...visit,
          ...updates,
          officeName: dbVisit.office_name ?? visit.officeName,
          pointsEarned: dbVisit.points_earned ?? visit.pointsEarned,
          status: dbVisit.status ?? visit.status
        }

        return updatedVisit
      }),
    )

    return updatedVisit
  }

  const deleteVisit = async (visitId) => {
    const target = visits.find((item) => item.id === visitId)
    if (!target || (!canManageVisit(target) && activeUser?.role !== 'admin' && activeUser?.role !== 'superadmin')) {
      return false
    }

    const { error } = await supabase.from('visits').delete().eq('id', visitId)
    if (error) {
      console.error('Error deleting visit:', error)
      return false
    }

    setVisits((previous) => previous.filter((item) => item.id !== visitId))
    setIssues((previous) => previous.filter((issue) => issue.visitId !== visitId))

    if (target.status === 'مكتملة') {
      setShoppers((previous) =>
        previous.map((shopper) => {
          if (shopper.id !== target.assignedShopperId) return shopper

          return {
            ...shopper,
            visits: Math.max(0, Number(shopper.visits ?? 0) - 1),
            points: Math.max(0, Number(shopper.points ?? 0) - Number(target.pointsEarned ?? 0)),
          }
        }),
      )
    }

    return true
  }

  const awardShopperPoints = async (shopperId, amount) => {
    if (!canManageShopper(shopperId)) return null

    const targetShopper = shoppers.find(s => s.id === shopperId);
    if (!targetShopper) return null;

    const newPoints = Math.max(0, Number(targetShopper.points ?? 0) + Number(amount ?? 0));
    
    const { data: dbShopper, error } = await supabase.from('shoppers').update({ points: newPoints }).eq('id', shopperId).select().single()
    if (error || !dbShopper) return null;

    let updatedShopper = null

    setShoppers((previous) =>
      previous.map((shopper) => {
        if (shopper.id !== shopperId) return shopper

        updatedShopper = {
          ...shopper,
          points: dbShopper.points,
        }

        return updatedShopper
      }),
    )

    return updatedShopper
  }

  const completeVisit = async (visitId, payload) => {
    const targetVisit = visits.find((visit) => visit.id === visitId)
    if (!targetVisit) return null

    if (
      activeUser?.role !== 'shopper' ||
      targetVisit.assignedShopperId !== activeUser.id
    ) {
      return null
    }

    const finalScore = calculateWeightedScore(payload.scores)
    const generatedIssues = getGeneratedIssues(payload.scores, evaluationCriteria)

    const relatedShopper = shoppers.find(
      (shopper) => shopper.id === targetVisit.assignedShopperId,
    )

    const wasCompleted = targetVisit.status === 'مكتملة'
    const completedVisitsCount = Number(relatedShopper?.visits ?? 0) + (wasCompleted ? 0 : 1)

    const pointsEarned = calculateVisitPoints({
      images: 2,
      videos: 1,
      issueSeverity: generatedIssues.map((issue) => issue.severity),
      hasComprehensiveReport: payload.notes.trim().length >= 30,
      isFastCompletion: true,
      hasAccurateInfo: finalScore >= 3.5,
      completedVisits: completedVisitsCount,
    })

    const mediaPoints = normalizeVisitFileUrls(targetVisit.file_urls).reduce(
      (sum, path) => sum + getFilePointsFromPath(path),
      0,
    )

    const finalVisitPoints = pointsEarned + mediaPoints

    setVisits((previous) =>
      previous.map((visit) => {
        if (visit.id !== visitId) return visit

        return {
          ...visit,
          status: 'مكتملة',
          scores: payload.scores,
          notes: payload.notes,
          pointsEarned: finalVisitPoints,
          file_urls: Array.isArray(visit.file_urls) ? visit.file_urls : [],
        }
      }),
    )

    setShoppers((previous) =>
      previous.map((shopper) => {
        if (shopper.id !== targetVisit.assignedShopperId) return shopper

        const previousPoints = wasCompleted
          ? Number(targetVisit.pointsEarned ?? 0)
          : mediaPoints

        return {
          ...shopper,
          visits: Number(shopper.visits ?? 0) + (wasCompleted ? 0 : 1),
          points: Math.max(
            0,
            Number(shopper.points ?? 0) - previousPoints + finalVisitPoints,
          ),
        }
      }),
    )

    setIssues((previous) => {
      const remaining = previous.filter((issue) => issue.visitId !== visitId)
      const attached = generatedIssues.map((issue) => ({
        ...issue,
        visitId,
        officeName: targetVisit.officeName,
        city: targetVisit.city,
        date: targetVisit.date,
      }))

      return [...remaining, ...attached]
    })

    return finalVisitPoints
  }

  const updateVisitFiles = async ({ visitId, fileUrls, pointsDelta = 0 }) => {
    const targetVisit = visits.find((visit) => visit.id === visitId)
    if (!targetVisit) {
      throw new Error('visit-not-found')
    }

    if (activeUser?.role !== 'shopper' || targetVisit.assignedShopperId !== activeUser.id) {
      throw new Error('not-allowed')
    }

    const nextFileUrls = Array.isArray(fileUrls) ? fileUrls : []
    const delta = Number(pointsDelta ?? 0)

    const { error: visitSyncError } = await supabase
      .from('visits')
      .update({ file_urls: nextFileUrls })
      .eq('id', visitId)

    if (visitSyncError) {
      throw visitSyncError
    }

    setVisits((previous) =>
      previous.map((visit) => {
        if (visit.id !== visitId) return visit

        return {
          ...visit,
          file_urls: nextFileUrls,
          pointsEarned: Math.max(0, Number(visit.pointsEarned ?? 0) + delta),
        }
      }),
    )

    if (delta !== 0) {
      const shopperBefore = shoppers.find((shopper) => shopper.id === targetVisit.assignedShopperId)
      const nextPoints = Math.max(0, Number(shopperBefore?.points ?? 0) + delta)

      setShoppers((previous) =>
        previous.map((shopper) => {
          if (shopper.id !== targetVisit.assignedShopperId) return shopper

          return {
            ...shopper,
            points: Math.max(0, Number(shopper.points ?? 0) + delta),
          }
        }),
      )

      const { error: shopperSyncError } = await supabase
        .from('shoppers')
        .update({ points: nextPoints })
        .eq('id', targetVisit.assignedShopperId)

      if (shopperSyncError) {
        console.warn('تعذر مزامنة نقاط المتسوق مع Supabase', shopperSyncError.message)
      }
    }

    return true
  }

  const adminScopeProps = {
    user: activeUser,
    shoppers: scopedShoppers,
    visits: scopedVisits,
    issues: scopedIssues,
    offices,
    evaluationCriteria,
    pointsRules,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    isLive: true,
    adminHasAssignments: assignedShopperIds.length > 0,
    addShopper,
    updateShopper,
    updateShopperStatus,
    deleteShopper,
    addVisit,
    updateVisit,
    deleteVisit,
    completeVisit,
    awardShopperPoints,
    onLogout: handleLogout,
  }

  const superAdminScopeProps = {
    user: activeUser,
    subAdmins,
    shoppers,
    visits: visitsWithIssues,
    issues,
    offices,
    evaluationCriteria,
    pointsRules,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    isLive: true,
    addSubAdmin,
    updateSubAdmin,
    deleteSubAdmin,
    assignSubAdminShoppers,
    addShopper,
    updateShopper,
    updateShopperStatus,
    deleteShopper,
    addVisit,
    updateVisit,
    deleteVisit,
    completeVisit,
    awardShopperPoints,
    onLogout: handleLogout,
  }

  const shopperScopeProps = {
    user: activeUser,
    shoppers,
    visits: visitsWithIssues,
    issues,
    offices,
    evaluationCriteria,
    pointsRules,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    completeVisit,
    updateVisitFiles,
    onLogout: handleLogout,
  }

  const defaultPath = activeUser ? getRoleHome(activeUser.role) : '/'

  return (
    <Routes>
      <Route
        path="/"
        element={
          activeUser ? <Navigate to={defaultPath} replace /> : <Login onLogin={handleLogin} />
        }
      />

      <Route path="/login" element={<Navigate to="/" replace />} />

      <Route
        path="/superadmin"
        element={
          <ProtectedRoute user={activeUser} allowedRole="superadmin">
            <SuperAdminLayout {...superAdminScopeProps} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<SuperAdminOverview />} />
        <Route path="managers" element={<ManageAdmins />} />
        <Route path="shoppers" element={<Shoppers />} />
        <Route path="visits" element={<Visits />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="points" element={<Points />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute user={activeUser} allowedRole="admin">
            <AdminLayout {...adminScopeProps} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<Overview />} />
        <Route path="shoppers" element={<Shoppers />} />
        <Route path="visits" element={<Visits />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="points" element={<Points />} />
      </Route>

      <Route
        path="/shopper"
        element={
          <ProtectedRoute user={activeUser} allowedRole="shopper">
            <ShopperLayout {...shopperScopeProps} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<ShopperDashboard />} />
        <Route path="visits" element={<MyVisits />} />
        <Route path="visits/:visitId" element={<VisitDetail />} />
        <Route path="completed" element={<CompletedVisits />} />
        <Route path="completed/:visitId" element={<VisitDetail fromCompleted />} />
        <Route path="reports" element={<ShopperReports />} />
      </Route>

      <Route path="*" element={<Navigate to={defaultPath} replace />} />
    </Routes>
  )
}

export default App
