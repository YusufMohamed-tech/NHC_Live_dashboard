import { useMemo, useState } from 'react'
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
import { supabase } from './lib/supabase'
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
  const [subAdmins, setSubAdmins] = useState(() => [...initialSubAdmins])
  const [shoppers, setShoppers] = useState(() => [...initialShoppers])
  const [visits, setVisits] = useState(() => [...initialVisits])
  const [issues, setIssues] = useState(() => [...initialIssues])

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

  const dataLoading = false
  const dataError = ''

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

    const nextShopper = {
      id: makeId('shopper'),
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      password: payload.password,
      city: payload.city.trim(),
      visits: 0,
      points: 0,
      status: payload.status ?? 'نشط',
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
    }

    return nextShopper
  }

  const updateShopper = async (shopperId, updates) => {
    if (!canManageShopper(shopperId)) return null

    let nextShopper = null

    setShoppers((previous) =>
      previous.map((item) => {
        if (item.id !== shopperId) return item

        nextShopper = {
          ...item,
          ...updates,
          email: updates.email ? normalizeEmail(updates.email) : item.email,
          name: updates.name ? updates.name.trim() : item.name,
          city: updates.city ? updates.city.trim() : item.city,
        }

        return nextShopper
      }),
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

    const nextVisit = {
      id: makeId('visit'),
      officeName: payload.officeName.trim(),
      city: payload.city.trim(),
      type: payload.type ?? 'مكتب مبيعات',
      date: payload.date,
      time: payload.time,
      status: payload.status ?? 'معلقة',
      assignedShopperId: payload.assignedShopperId,
      scenario: payload.scenario?.trim() ?? '',
      membershipId: payload.membershipId?.trim() || generateMembershipId(),
      scores: payload.scores ?? makeEmptyScores(evaluationCriteria),
      notes: payload.notes ?? '',
      pointsEarned: payload.pointsEarned ?? 0,
      waitMinutes: payload.waitMinutes ?? 0,
      file_urls: Array.isArray(payload.file_urls) ? payload.file_urls : [],
    }

    setVisits((previous) => [nextVisit, ...previous])
    return nextVisit
  }

  const updateVisit = async (visitId, updates) => {
    if (!activeUser || !['superadmin', 'admin'].includes(activeUser.role)) return null

    let updatedVisit = null

    setVisits((previous) =>
      previous.map((visit) => {
        if (visit.id !== visitId) return visit
        if (!canManageVisit(visit)) return visit

        updatedVisit = {
          ...visit,
          ...updates,
        }

        return updatedVisit
      }),
    )

    return updatedVisit
  }

  const deleteVisit = async (visitId) => {
    let removedVisit = null

    setVisits((previous) => {
      const target = previous.find((item) => item.id === visitId)
      if (!target || !canManageVisit(target)) {
        return previous
      }

      removedVisit = target
      return previous.filter((item) => item.id !== visitId)
    })

    if (!removedVisit) {
      return false
    }

    setIssues((previous) => previous.filter((issue) => issue.visitId !== visitId))

    if (removedVisit.status === 'مكتملة') {
      setShoppers((previous) =>
        previous.map((shopper) => {
          if (shopper.id !== removedVisit.assignedShopperId) return shopper

          return {
            ...shopper,
            visits: Math.max(0, Number(shopper.visits ?? 0) - 1),
            points: Math.max(0, Number(shopper.points ?? 0) - Number(removedVisit.pointsEarned ?? 0)),
          }
        }),
      )
    }

    return true
  }

  const awardShopperPoints = async (shopperId, amount) => {
    if (!canManageShopper(shopperId)) return null

    let updatedShopper = null

    setShoppers((previous) =>
      previous.map((shopper) => {
        if (shopper.id !== shopperId) return shopper

        updatedShopper = {
          ...shopper,
          points: Math.max(0, Number(shopper.points ?? 0) + Number(amount ?? 0)),
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
    dataLoading,
    dataError,
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
    dataLoading,
    dataError,
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
    dataLoading,
    dataError,
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
