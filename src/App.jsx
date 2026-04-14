import { Suspense, lazy, useMemo, useState, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { calculateWeightedScore } from './utils/scoring'
import { getFilePointsFromPath, normalizeVisitFileUrls } from './utils/visitFiles'

const Login = lazy(() => import('./pages/Login'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Overview = lazy(() => import('./pages/admin/Overview'))
const Shoppers = lazy(() => import('./pages/admin/Shoppers'))
const Visits = lazy(() => import('./pages/admin/Visits'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))
const Points = lazy(() => import('./pages/admin/Points'))
const ShopperLayout = lazy(() => import('./pages/shopper/ShopperLayout'))
const ShopperDashboard = lazy(() => import('./pages/shopper/Dashboard'))
const MyVisits = lazy(() => import('./pages/shopper/MyVisits'))
const VisitDetail = lazy(() => import('./pages/shopper/VisitDetail'))
const CompletedVisits = lazy(() => import('./pages/shopper/CompletedVisits'))
const ShopperReports = lazy(() => import('./pages/shopper/Reports'))
const SuperAdminLayout = lazy(() => import('./pages/superadmin/SuperAdminLayout'))
const SuperAdminOverview = lazy(() => import('./pages/superadmin/Overview'))
const ManageAdmins = lazy(() => import('./pages/superadmin/ManageAdmins'))

const AUTH_STORAGE_KEY = 'nhc-mystery-auth'

const SUPER_ADMIN_ACCOUNT = {
  id: 'superadmin-root',
  name: import.meta.env.VITE_SUPERADMIN_NAME?.trim() || 'المدير العام',
  email: import.meta.env.VITE_SUPERADMIN_EMAIL?.trim() || 'superadmin@nhc.sa',
  password: import.meta.env.VITE_SUPERADMIN_PASSWORD?.trim() || '',
  role: 'superadmin',
}

const EMPTY_POINTS_RULES = {
  visits: [],
  issues: [],
  quality: [],
  achievements: [],
}

const DEFAULT_POINT_RULES = {
  visits: {
    complete: 50,
    image: 5,
    video: 10,
  },
  issues: {
    بسيطة: 15,
    متوسطة: 30,
    خطيرة: 50,
  },
  quality: {
    report: 25,
    speed: 15,
    accuracy: 20,
  },
  achievements: {
    milestone5: 50,
    milestone10: 100,
    milestone20: 200,
  },
}

const RIYADH_TIME_ZONE = 'Asia/Riyadh'
const RIYADH_UTC_OFFSET = '+03:00'

function getRoleHome(role) {
  if (role === 'superadmin') return '/superadmin/overview'
  if (role === 'admin') return '/admin/overview'
  if (role === 'shopper') return '/shopper/dashboard'
  return '/'
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function toArabicUserStatus(value) {
  return value === 'active' || value === 'نشط' ? 'نشط' : 'غير نشط'
}

function toDbUserStatus(value) {
  return value === 'active' || value === 'نشط' ? 'active' : 'inactive'
}

function generateMembershipId() {
  return `NHC-${Math.floor(10000 + Math.random() * 90000)}`
}

function parseVisitDateTime(date, time) {
  const dateValue = String(date ?? '').trim()
  if (!dateValue) return new Date().toISOString()

  const normalizedTime = String(time ?? '').trim()
  const match = normalizedTime.match(/(\d{1,2}):(\d{2})\s*(صباحاً|مساءً|AM|PM|am|pm)?/u)

  let hour = 0
  let minute = 0

  if (match) {
    hour = Number(match[1])
    minute = Number(match[2])
    const period = String(match[3] ?? '').toLowerCase()

    if ((period === 'مساءً' || period === 'pm') && hour < 12) {
      hour += 12
    }

    if ((period === 'صباحاً' || period === 'am') && hour === 12) {
      hour = 0
    }
  }

  const safeHour = Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 0
  const safeMinute = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0

  return `${dateValue}T${String(safeHour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}:00${RIYADH_UTC_OFFSET}`
}

function formatVisitDate(visitDate) {
  if (!visitDate) return ''

  const date = new Date(visitDate)
  if (Number.isNaN(date.getTime())) {
    return String(visitDate).split('T')[0]
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'

  return `${year}-${month}-${day}`
}

function formatVisitTime(visitDate) {
  if (!visitDate) return '10:00 صباحاً'
  const date = new Date(visitDate)

  if (Number.isNaN(date.getTime())) {
    return '10:00 صباحاً'
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const hour24 = Number(parts.find((part) => part.type === 'hour')?.value ?? '10')
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  const period = hour24 >= 12 ? 'مساءً' : 'صباحاً'
  const hour12 = hour24 % 12 || 12

  return `${String(hour12).padStart(2, '0')}:${minute} ${period}`
}

function normalizeAssignedIds(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function mapAdminRow(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    email: normalizeEmail(row.email),
    password: row.password ?? '',
    city: row.city ?? '',
    status: toArabicUserStatus(row.status),
    role: row.role ?? 'admin',
    assignedShopperIds: normalizeAssignedIds(row.assigned_shopper_ids),
  }
}

function mapShopperRow(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    email: normalizeEmail(row.email),
    password: row.password ?? '',
    city: row.city ?? '',
    status: toArabicUserStatus(row.status),
    visits: Number(row.visits_completed ?? 0),
    points: Number(row.points ?? 0),
    assignedAdminId: row.assigned_admin_id ?? null,
  }
}

function mapVisitRow(row) {
  const fileUrls = normalizeVisitFileUrls(row.file_urls)

  return {
    id: row.id,
    officeName: row.office_name ?? '',
    city: row.city ?? '',
    type: row.type ?? 'مكتب مبيعات',
    status: row.status ?? 'معلقة',
    scenario: row.scenario ?? '',
    membershipId: row.membership_id ?? '',
    assignedShopperId: row.shopper_id ?? null,
    date: formatVisitDate(row.visit_date),
    time: formatVisitTime(row.visit_date),
    scores: row.scores && typeof row.scores === 'object' ? row.scores : {},
    notes: row.notes ?? '',
    pointsEarned: Number(row.points_earned ?? 0),
    file_urls: fileUrls,
  }
}

function mapIssueRow(row) {
  return {
    id: row.id,
    visitId: row.visit_id,
    severity: row.severity,
    description: row.description,
    createdAt: row.created_at,
  }
}

function mapOfficeRow(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    city: row.city ?? '',
    type: row.type ?? 'مكتب مبيعات',
    location: row.location ?? '',
    status: row.status ?? 'active',
  }
}

function mapPointsRules(rows) {
  const next = {
    visits: [],
    issues: [],
    quality: [],
    achievements: [],
  }

  rows.forEach((row) => {
    if (!next[row.category]) return
    next[row.category].push({
      label: row.condition,
      points: Number(row.points ?? 0),
    })
  })

  return next
}

function findRulePoints(rules, category, matcher, fallback) {
  const rule = (rules?.[category] ?? []).find((item) => matcher(item.label))
  return Number(rule?.points ?? fallback)
}

function getMilestonePoints(rules, completedVisits) {
  if (completedVisits === 20) {
    return findRulePoints(
      rules,
      'achievements',
      (label) => label.includes('20'),
      DEFAULT_POINT_RULES.achievements.milestone20,
    )
  }

  if (completedVisits === 10) {
    return findRulePoints(
      rules,
      'achievements',
      (label) => label.includes('10'),
      DEFAULT_POINT_RULES.achievements.milestone10,
    )
  }

  if (completedVisits === 5) {
    return findRulePoints(
      rules,
      'achievements',
      (label) => label.includes('5'),
      DEFAULT_POINT_RULES.achievements.milestone5,
    )
  }

  return 0
}

function calculateVisitPointsFromRules({
  rules,
  images = 0,
  videos = 0,
  issueSeverity = [],
  hasComprehensiveReport = false,
  isFastCompletion = false,
  hasAccurateInfo = false,
  completedVisits = 0,
}) {
  let total = findRulePoints(
    rules,
    'visits',
    (label) => label.includes('إكمال'),
    DEFAULT_POINT_RULES.visits.complete,
  )

  total +=
    images *
    findRulePoints(
      rules,
      'visits',
      (label) => label.includes('صورة'),
      DEFAULT_POINT_RULES.visits.image,
    )

  total +=
    videos *
    findRulePoints(
      rules,
      'visits',
      (label) => label.includes('فيديو'),
      DEFAULT_POINT_RULES.visits.video,
    )

  issueSeverity.forEach((severity) => {
    total += findRulePoints(
      rules,
      'issues',
      (label) => label.includes(severity),
      DEFAULT_POINT_RULES.issues[severity] ?? 0,
    )
  })

  if (hasComprehensiveReport) {
    total += findRulePoints(
      rules,
      'quality',
      (label) => label.includes('شامل'),
      DEFAULT_POINT_RULES.quality.report,
    )
  }

  if (isFastCompletion) {
    total += findRulePoints(
      rules,
      'quality',
      (label) => label.includes('سرعة'),
      DEFAULT_POINT_RULES.quality.speed,
    )
  }

  if (hasAccurateInfo) {
    total += findRulePoints(
      rules,
      'quality',
      (label) => label.includes('دقة'),
      DEFAULT_POINT_RULES.quality.accuracy,
    )
  }

  total += getMilestonePoints(rules, completedVisits)

  return total
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
  const [offices, setOffices] = useState([])
  const [evaluationCriteria, setEvaluationCriteria] = useState([])
  const [pointsRules, setPointsRules] = useState(EMPTY_POINTS_RULES)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (!SUPER_ADMIN_ACCOUNT.password) {
      console.warn('VITE_SUPERADMIN_PASSWORD غير معرف، تسجيل دخول المدير العام سيكون معطلاً.')
    }
  }, [])

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
          { data: issuesData, error: issuesError },
          { data: officesData, error: officesError },
          { data: criteriaData, error: criteriaError },
          { data: pointsData, error: pointsError },
        ] = await Promise.all([
          supabase.from('admins').select('*'),
          supabase.from('shoppers').select('*'),
          supabase.from('visits').select('*'),
          supabase.from('issues').select('*'),
          supabase.from('offices').select('*'),
          supabase.from('evaluation_criteria').select('*').order('key'),
          supabase.from('points_rules').select('*'),
        ])

        if (adminsError) throw adminsError
        if (shoppersError) throw shoppersError
        if (visitsError) throw visitsError
        if (issuesError) throw issuesError
        if (officesError) throw officesError
        if (criteriaError) throw criteriaError
        if (pointsError) throw pointsError

        if (mounted) {
          const mappedAdmins = (adminsData ?? [])
            .map(mapAdminRow)
            .filter((admin) => admin.role === 'admin')
          const mappedShoppers = (shoppersData ?? []).map(mapShopperRow)
          const mappedVisits = (visitsData ?? []).map(mapVisitRow)
          const mappedIssues = (issuesData ?? []).map(mapIssueRow)
          const mappedOffices = (officesData ?? []).map(mapOfficeRow)

          setSubAdmins(mappedAdmins)
          setShoppers(mappedShoppers)
          setVisits(mappedVisits)
          setIssues(mappedIssues)
          setOffices(mappedOffices)
          setEvaluationCriteria(criteriaData ?? [])
          setPointsRules(mapPointsRules(pointsData ?? []))
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

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admins' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSubAdmins((previous) => previous.filter((admin) => admin.id !== payload.old.id))
            return
          }

          const mappedAdmin = mapAdminRow(payload.new)
          if (mappedAdmin.role !== 'admin') return

          setSubAdmins((previous) => {
            const exists = previous.some((admin) => admin.id === mappedAdmin.id)
            if (!exists) return [mappedAdmin, ...previous]

            return previous.map((admin) =>
              admin.id === mappedAdmin.id ? mappedAdmin : admin,
            )
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shoppers' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setShoppers((previous) => previous.filter((shopper) => shopper.id !== payload.old.id))
            return
          }

          const mappedShopper = mapShopperRow(payload.new)

          setShoppers((previous) => {
            const exists = previous.some((shopper) => shopper.id === mappedShopper.id)
            if (!exists) return [mappedShopper, ...previous]

            return previous.map((shopper) =>
              shopper.id === mappedShopper.id ? mappedShopper : shopper,
            )
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setVisits((previous) => previous.filter((visit) => visit.id !== payload.old.id))
            setIssues((previous) =>
              previous.filter((issue) => issue.visitId !== payload.old.id),
            )
            return
          }

          const mappedVisit = mapVisitRow(payload.new)

          setVisits((previous) => {
            const exists = previous.some((visit) => visit.id === mappedVisit.id)
            if (!exists) return [mappedVisit, ...previous]

            return previous.map((visit) =>
              visit.id === mappedVisit.id ? mappedVisit : visit,
            )
          })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setIssues((previous) => previous.filter((issue) => issue.id !== payload.old.id))
            return
          }

          const mappedIssue = mapIssueRow(payload.new)
          setIssues((previous) => {
            const exists = previous.some((issue) => issue.id === mappedIssue.id)
            if (!exists) return [mappedIssue, ...previous]

            return previous.map((issue) =>
              issue.id === mappedIssue.id ? mappedIssue : issue,
            )
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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

  const issuesWithVisitMeta = useMemo(() => {
    const visitsMap = new Map(visits.map((visit) => [visit.id, visit]))

    return issues.map((issue) => {
      const relatedVisit = visitsMap.get(issue.visitId)
      return {
        ...issue,
        officeName: relatedVisit?.officeName ?? '',
        city: relatedVisit?.city ?? '',
        date: relatedVisit?.date ?? '',
      }
    })
  }, [issues, visits])

  const issuesByVisit = useMemo(() => {
    const map = new Map()

    issuesWithVisitMeta.forEach((issue) => {
      const current = map.get(issue.visitId) ?? []
      map.set(issue.visitId, [...current, issue])
    })

    return map
  }, [issuesWithVisitMeta])

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
    if (activeUser?.role !== 'admin') return issuesWithVisitMeta

    const scopedVisitIds = new Set(scopedVisits.map((visit) => visit.id))
    return issuesWithVisitMeta.filter((issue) => scopedVisitIds.has(issue.visitId))
  }, [activeUser, issuesWithVisitMeta, scopedVisits])

  const dataLoadingValue = dataLoading
  const dataErrorValue = dataError

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
      SUPER_ADMIN_ACCOUNT.password &&
      normalizedEmail === normalizeEmail(SUPER_ADMIN_ACCOUNT.email) &&
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

    const insertPayload = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      password: payload.password,
      city: payload.city.trim(),
      status: toDbUserStatus(payload.status),
      role: 'admin',
      assigned_shopper_ids: validAssigned,
    }

    const { data: insertedAdmin, error } = await supabase
      .from('admins')
      .insert([insertPayload])
      .select('*')
      .single()

    if (error || !insertedAdmin) {
      console.error('Error adding admin:', error)
      return null
    }

    const nextSubAdmin = mapAdminRow(insertedAdmin)

    setSubAdmins((previous) => [nextSubAdmin, ...previous])
    return nextSubAdmin
  }

  const updateSubAdmin = async (subAdminId, updates) => {
    if (activeUser?.role !== 'superadmin') return null

    const currentAdmin = subAdmins.find((admin) => admin.id === subAdminId)
    if (!currentAdmin) return null

    const assignedSet = new Set(updates.assignedShopperIds ?? currentAdmin.assignedShopperIds ?? [])
    const validAssigned = shoppers
      .filter((shopper) => assignedSet.has(shopper.id))
      .map((shopper) => shopper.id)

    const dbUpdates = {
      name: updates.name ? updates.name.trim() : currentAdmin.name,
      email: updates.email ? normalizeEmail(updates.email) : currentAdmin.email,
      password: updates.password ?? currentAdmin.password,
      city: updates.city ? updates.city.trim() : currentAdmin.city,
      status: updates.status ? toDbUserStatus(updates.status) : toDbUserStatus(currentAdmin.status),
      assigned_shopper_ids: validAssigned,
    }

    const { data: updatedAdminRow, error } = await supabase
      .from('admins')
      .update(dbUpdates)
      .eq('id', subAdminId)
      .select('*')
      .single()

    if (error || !updatedAdminRow) {
      console.error('Error updating admin:', error)
      return null
    }

    const updatedItem = mapAdminRow(updatedAdminRow)

    setSubAdmins((previous) =>
      previous.map((item) => (item.id === subAdminId ? updatedItem : item)),
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

    const dbStatus = toDbUserStatus(payload.status)

    const assignedAdminId = activeUser.role === 'admin' ? activeUser.id : null

    const newShopperData = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      password: payload.password,
      city: payload.city.trim(),
      visits_completed: 0,
      points: 0,
      status: dbStatus,
      assigned_admin_id: assignedAdminId,
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

    const nextShopper = mapShopperRow(dbShopper)

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
        const { error: adminSyncError } = await supabase
          .from('admins')
          .update({ assigned_shopper_ids: Array.from(assigned) })
          .eq('id', activeUser.id)

        if (adminSyncError) {
          console.warn('تعذر مزامنة تعيينات المدير بعد إضافة المتسوق', adminSyncError.message)
        }
      }
    }

    return nextShopper
  }

  const updateShopper = async (shopperId, updates) => {
    if (!canManageShopper(shopperId)) return null

    const dbUpdates = {}
    if (updates.name) dbUpdates.name = updates.name.trim()
    if (updates.email) dbUpdates.email = normalizeEmail(updates.email)
    if (updates.city) dbUpdates.city = updates.city.trim()
    if (updates.password) dbUpdates.password = updates.password
    if (updates.status) {
      dbUpdates.status = toDbUserStatus(updates.status)
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

    const nextShopper = mapShopperRow(dbShopper)

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

    setVisits((previous) => {
      const remainingVisits = previous.filter((visit) => visit.assignedShopperId !== shopperId)
      const remainingVisitIds = new Set(remainingVisits.map((visit) => visit.id))

      setIssues((issuesPrevious) =>
        issuesPrevious.filter((issue) => remainingVisitIds.has(issue.visitId)),
      )

      return remainingVisits
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
      visit_date: parseVisitDateTime(payload.date, payload.time),
      scores: payload.scores ?? makeEmptyScores(evaluationCriteria),
      notes: payload.notes ?? '',
      points_earned: payload.pointsEarned ?? 0,
      file_urls: normalizeVisitFileUrls(payload.file_urls),
    }

    const { data: dbVisit, error } = await supabase
      .from('visits')
      .insert([dbPayload])
      .select('*')
      .single()

    if (error || !dbVisit) {
      console.error('Error adding visit:', error)
      return null
    }

    const nextVisit = mapVisitRow(dbVisit)

    setVisits((previous) => [nextVisit, ...previous])
    return nextVisit
  }

  const updateVisit = async (visitId, updates) => {
    if (!activeUser || !['superadmin', 'admin', 'shopper'].includes(activeUser.role)) return null

    const targetVisit = visits.find((visit) => visit.id === visitId)
    if (!targetVisit) return null

    if (activeUser.role === 'shopper') {
      if (targetVisit.assignedShopperId !== activeUser.id) return null
    } else if (!canManageVisit(targetVisit)) {
      return null
    }

    const dbUpdates = {}
    if (updates.officeName !== undefined) dbUpdates.office_name = String(updates.officeName ?? '').trim()
    if (updates.city !== undefined) dbUpdates.city = String(updates.city ?? '').trim()
    if (updates.type !== undefined) dbUpdates.type = updates.type
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.scenario !== undefined) dbUpdates.scenario = String(updates.scenario ?? '').trim()
    if (updates.membershipId !== undefined) dbUpdates.membership_id = String(updates.membershipId ?? '').trim()
    if (updates.assignedShopperId !== undefined) dbUpdates.shopper_id = updates.assignedShopperId
    if (updates.scores !== undefined) dbUpdates.scores = updates.scores
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes
    if (updates.pointsEarned !== undefined) dbUpdates.points_earned = updates.pointsEarned

    if (updates.file_urls !== undefined) {
      dbUpdates.file_urls = normalizeVisitFileUrls(updates.file_urls)
    }

    if (updates.date !== undefined || updates.time !== undefined) {
      dbUpdates.visit_date = parseVisitDateTime(
        updates.date ?? targetVisit.date,
        updates.time ?? targetVisit.time,
      )
    }

    const { data: dbVisit, error } = await supabase
      .from('visits')
      .update(dbUpdates)
      .eq('id', visitId)
      .select('*')
      .single()

    if (error || !dbVisit) {
      console.error('Error updating visit:', error)
      return null
    }

    const updatedVisit = mapVisitRow(dbVisit)

    setVisits((previous) =>
      previous.map((visit) => (visit.id === visitId ? updatedVisit : visit)),
    )

    return updatedVisit
  }

  const deleteVisit = async (visitId) => {
    const target = visits.find((item) => item.id === visitId)
    if (!target || (!canManageVisit(target) && activeUser?.role !== 'superadmin')) {
      return false
    }

    const { error: issuesDeleteError } = await supabase
      .from('issues')
      .delete()
      .eq('visit_id', visitId)

    if (issuesDeleteError) {
      console.error('Error deleting issues for visit:', issuesDeleteError)
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
      const targetShopper = shoppers.find((shopper) => shopper.id === target.assignedShopperId)
      const nextVisitsCompleted = Math.max(0, Number(targetShopper?.visits ?? 0) - 1)
      const nextPoints = Math.max(
        0,
        Number(targetShopper?.points ?? 0) - Number(target.pointsEarned ?? 0),
      )

      const { error: shopperUpdateError } = await supabase
        .from('shoppers')
        .update({
          visits_completed: nextVisitsCompleted,
          points: nextPoints,
        })
        .eq('id', target.assignedShopperId)

      if (shopperUpdateError) {
        console.error('Error syncing shopper totals after deleting visit:', shopperUpdateError)
        return false
      }

      setShoppers((previous) =>
        previous.map((shopper) => {
          if (shopper.id !== target.assignedShopperId) return shopper

          return {
            ...shopper,
            visits: nextVisitsCompleted,
            points: nextPoints,
          }
        }),
      )
    }

    return true
  }

  const awardShopperPoints = async (shopperId, amount) => {
    if (!canManageShopper(shopperId)) return null

    const targetShopper = shoppers.find((shopper) => shopper.id === shopperId)
    if (!targetShopper) return null

    const newPoints = Math.max(0, Number(targetShopper.points ?? 0) + Number(amount ?? 0))
    
    const { data: dbShopper, error } = await supabase
      .from('shoppers')
      .update({ points: newPoints })
      .eq('id', shopperId)
      .select('*')
      .single()

    if (error || !dbShopper) return null

    const mappedShopper = mapShopperRow(dbShopper)

    let updatedShopper = null

    setShoppers((previous) =>
      previous.map((shopper) => {
        if (shopper.id !== shopperId) return shopper

        updatedShopper = mappedShopper

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

    const pointsEarned = calculateVisitPointsFromRules({
      rules: pointsRules,
      images: 2,
      videos: 1,
      issueSeverity: generatedIssues.map((issue) => issue.severity),
      hasComprehensiveReport: String(payload.notes ?? '').trim().length >= 30,
      isFastCompletion: true,
      hasAccurateInfo: finalScore >= 3.5,
      completedVisits: completedVisitsCount,
    })

    const mediaPoints = normalizeVisitFileUrls(targetVisit.file_urls).reduce(
      (sum, path) => sum + getFilePointsFromPath(path),
      0,
    )

    const finalVisitPoints = pointsEarned + mediaPoints

    const previousPoints = wasCompleted
      ? Number(targetVisit.pointsEarned ?? 0)
      : mediaPoints

    const nextShopperVisits = Number(relatedShopper?.visits ?? 0) + (wasCompleted ? 0 : 1)
    const nextShopperPoints = Math.max(
      0,
      Number(relatedShopper?.points ?? 0) - previousPoints + finalVisitPoints,
    )

    const { data: updatedVisitRow, error: visitUpdateError } = await supabase
      .from('visits')
      .update({
        status: 'مكتملة',
        scores: payload.scores,
        notes: payload.notes,
        points_earned: finalVisitPoints,
      })
      .eq('id', visitId)
      .select('*')
      .single()

    if (visitUpdateError || !updatedVisitRow) {
      console.error('Error completing visit:', visitUpdateError)
      return null
    }

    const { error: shopperUpdateError } = await supabase
      .from('shoppers')
      .update({
        visits_completed: nextShopperVisits,
        points: nextShopperPoints,
      })
      .eq('id', targetVisit.assignedShopperId)

    if (shopperUpdateError) {
      console.error('Error syncing shopper after visit completion:', shopperUpdateError)
      return null
    }

    const { error: issueDeleteError } = await supabase
      .from('issues')
      .delete()
      .eq('visit_id', visitId)

    if (issueDeleteError) {
      console.error('Error replacing visit issues:', issueDeleteError)
      return null
    }

    let insertedIssues = []
    if (generatedIssues.length > 0) {
      const issueRows = generatedIssues.map((issue) => ({
        visit_id: visitId,
        severity: issue.severity,
        description: issue.description,
      }))

      const { data: insertedIssueRows, error: issueInsertError } = await supabase
        .from('issues')
        .insert(issueRows)
        .select('*')

      if (issueInsertError) {
        console.error('Error inserting generated issues:', issueInsertError)
        return null
      }

      insertedIssues = (insertedIssueRows ?? []).map(mapIssueRow)
    }

    setVisits((previous) =>
      previous.map((visit) => {
        if (visit.id !== visitId) return visit

        return mapVisitRow(updatedVisitRow)
      }),
    )

    setShoppers((previous) =>
      previous.map((shopper) => {
        if (shopper.id !== targetVisit.assignedShopperId) return shopper

        return {
          ...shopper,
          visits: nextShopperVisits,
          points: nextShopperPoints,
        }
      }),
    )

    setIssues((previous) => {
      const remaining = previous.filter((issue) => issue.visitId !== visitId)

      return [...remaining, ...insertedIssues]
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
    const nextVisitPoints = Math.max(0, Number(targetVisit.pointsEarned ?? 0) + delta)

    const { error: visitSyncError } = await supabase
      .from('visits')
      .update({
        file_urls: normalizeVisitFileUrls(nextFileUrls),
        points_earned: nextVisitPoints,
      })
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
          pointsEarned: nextVisitPoints,
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
    issues: issuesWithVisitMeta,
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
    issues: issuesWithVisitMeta,
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

  if (authUser && !activeUser && dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm font-semibold text-slate-600">جاري التحقق من الجلسة...</p>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100">
          <p className="text-sm font-semibold text-slate-600">جاري تحميل الصفحة...</p>
        </div>
      }
    >
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
    </Suspense>
  )
}

export default App
