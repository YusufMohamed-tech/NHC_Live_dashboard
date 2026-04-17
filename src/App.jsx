import { Suspense, lazy, useMemo, useState, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { calculateWeightedScore } from './utils/scoring'

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
const NotificationCenter = lazy(() => import('./pages/NotificationCenter'))

const AUTH_STORAGE_KEY = 'nhc-mystery-auth'
const SHOW_POINTS_SECTION = import.meta.env.DEV

const SUPER_ADMIN_ACCOUNT = {
  id: 'superadmin-root',
  name: import.meta.env.VITE_SUPERADMIN_NAME?.trim() || 'سوبر أدمن',
  email: import.meta.env.VITE_SUPERADMIN_EMAIL?.trim() || 'superadmin@nhc.sa',
  personalEmail:
    import.meta.env.VITE_SUPERADMIN_PERSONAL_EMAIL?.trim() ||
    'yusufmohamedyak55@gmail.com',
  password: import.meta.env.VITE_SUPERADMIN_PASSWORD?.trim() || '',
  role: 'superadmin',
}

const SUPABASE_FUNCTIONS_AUTH_TOKEN =
  import.meta.env.VITE_SUPABASE_ANON_JWT?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  ''

const SUPABASE_FUNCTIONS_PUBLIC_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

const SUPABASE_FUNCTIONS_ENDPOINT = (() => {
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')
  if (!baseUrl) return ''
  return `${baseUrl}/functions/v1/send-visit-notification`
})()

const EMPTY_POINTS_RULES = {
  visits: [],
  issues: [],
  quality: [],
  achievements: [],
}

const DEFAULT_POINT_RULES = {
  visits: {
    complete: 50,
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
  if (role === 'ops') return '/ops/overview'
  if (role === 'shopper') return '/shopper/dashboard'
  return '/'
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function looksLikeJwt(value) {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(value ?? '').trim())
}

function notificationEmailForUser(user) {
  const normalized = normalizeEmail(user?.personalEmail || user?.email)
  return normalized || ''
}

function dedupeRecipientsByEmail(recipients) {
  const seen = new Set()

  return recipients.filter((recipient) => {
    const email = normalizeEmail(recipient?.email)
    if (!email || seen.has(email)) return false
    seen.add(email)
    return true
  })
}

function dedupeNotificationRecipients(recipients) {
  const seen = new Set()

  return recipients.filter((recipient) => {
    const role = String(recipient?.role ?? '').trim()
    if (!role) return false

    const userId = String(recipient?.id ?? '').trim()
    const email = normalizeEmail(recipient?.email)
    const name = String(recipient?.name ?? '').trim().toLowerCase()
    const identity = userId || email || name

    if (!identity) return false

    const key = `${role}:${identity}`
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

function getInAppNotificationContent(eventType, visit, recipientRole) {
  const office = String(visit?.officeName ?? '').trim() || 'مكتب غير محدد'
  const city = String(visit?.city ?? '').trim()
  const date = String(visit?.date ?? '').trim()
  const time = String(visit?.time ?? '').trim()

  const suffixParts = [office, city, date, time].filter(Boolean)
  const suffix = suffixParts.length > 0 ? ` (${suffixParts.join(' - ')})` : ''

  if (eventType === 'visit_created') {
    return {
      title: 'تم إنشاء زيارة جديدة',
      description:
        recipientRole === 'superadmin'
          ? `تم إنشاء زيارة جديدة مع جميع التفاصيل${suffix}`
          : `تم إنشاء زيارة جديدة${suffix}`,
    }
  }

  if (eventType === 'visit_assigned') {
    return {
      title: recipientRole === 'shopper' ? 'تم إسناد زيارة جديدة لك' : 'تم إسناد زيارة جديدة',
      description: `يرجى مراجعة بيانات الزيارة${suffix}`,
    }
  }

  if (eventType === 'visit_delete_requested') {
    return {
      title: 'طلب حذف زيارة',
      description: `تم إرسال طلب حذف زيارة من فريق العمليات${suffix}`,
    }
  }

  if (eventType === 'visit_updated') {
    return {
      title: 'تم تعديل زيارة',
      description: `تم تحديث بيانات زيارة في النظام${suffix}`,
    }
  }

  if (eventType === 'visit_completed') {
    return {
      title: 'تم إكمال زيارة',
      description: `تم إكمال الزيارة بنجاح${suffix}`,
    }
  }

  return {
    title: 'تمت إعادة إسناد زيارة',
    description: `تم تغيير المتسوق المكلف بالزيارة${suffix}`,
  }
}

function isResendTestingRestrictionError(errorText) {
  return String(errorText ?? '')
    .toLowerCase()
    .includes('you can only send testing emails to your own email address')
}

function isMissingTableError(error, tableName) {
  const table = String(tableName ?? '').trim()
  if (!table) return false

  const message = String(error?.message ?? '').toLowerCase()
  const details = String(error?.details ?? '').toLowerCase()
  const hint = String(error?.hint ?? '').toLowerCase()

  const lookup = table.toLowerCase()
  return (
    message.includes('does not exist') && message.includes(lookup)
  ) || (
    details.includes('does not exist') && details.includes(lookup)
  ) || (
    hint.includes('create table') && hint.includes(lookup)
  )
}

function toArabicUserStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'active' || normalized === 'نشط' ? 'نشط' : 'غير نشط'
}

function toDbUserStatus(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'active' || normalized === 'نشط' ? 'active' : 'inactive'
}

function generateMembershipId() {
  return `NHC-${Math.floor(10000 + Math.random() * 90000)}`
}

function isRootSuperAdmin(user) {
  return user?.role === 'superadmin' && user.id === SUPER_ADMIN_ACCOUNT.id
}

function parseVisitDateTime(date, time) {
  const dateValue = String(date ?? '').trim()
  if (!dateValue) return new Date().toISOString()

  const normalizedTime = String(time ?? '').trim()

  if (normalizedTime === 'صباحية') {
    return `${dateValue}T10:00:00${RIYADH_UTC_OFFSET}`
  }

  if (normalizedTime === 'مسائية') {
    return `${dateValue}T18:00:00${RIYADH_UTC_OFFSET}`
  }

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
  if (!visitDate) return 'صباحية'
  const date = new Date(visitDate)

  if (Number.isNaN(date.getTime())) {
    return 'صباحية'
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: RIYADH_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const hour24 = Number(parts.find((part) => part.type === 'hour')?.value ?? '10')
  return hour24 >= 12 ? 'مسائية' : 'صباحية'
}

function normalizeAssignedIds(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function normalizeAdminRole(value) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (['superadmin', 'super_admin', 'super-admin'].includes(normalized)) {
    return 'superadmin'
  }

  if (['ops', 'operation', 'operations'].includes(normalized)) {
    return 'ops'
  }

  if (['admin', 'subadmin', 'sub-admin', 'administrator'].includes(normalized)) {
    return 'admin'
  }

  return normalized || 'admin'
}

function mapAdminRow(row) {
  const personalEmail =
    row.personal_email ?? row.secondary_email ?? row.email_personal ?? row.email ?? ''

  return {
    id: row.id,
    name: row.name ?? '',
    email: normalizeEmail(row.email),
    personalEmail: normalizeEmail(personalEmail),
    password: row.password ?? '',
    city: row.city ?? '',
    status: toArabicUserStatus(row.status),
    role: normalizeAdminRole(row.role),
    assignedShopperIds: normalizeAssignedIds(row.assigned_shopper_ids),
  }
}

function mapShopperRow(row) {
  const personalEmail = row.personal_email ?? row.secondary_email ?? row.email ?? ''

  return {
    id: row.id,
    name: row.name ?? '',
    email: normalizeEmail(row.email),
    personalEmail: normalizeEmail(personalEmail),
    password: row.password ?? '',
    city: row.city ?? '',
    primaryPhone: row.primary_phone ?? row.phone_primary ?? row.phone ?? '',
    whatsappPhone: row.whatsapp_phone ?? row.phone_whatsapp ?? row.whatsapp ?? '',
    status: toArabicUserStatus(row.status),
    visits: Number(row.visits_completed ?? 0),
    points: Number(row.points ?? 0),
    assignedAdminId: row.assigned_admin_id ?? null,
  }
}

function mapVisitRow(row) {
  return {
    id: row.id,
    officeName: row.office_name ?? '',
    city: row.city ?? '',
    type: row.type ?? 'عام',
    status: row.status ?? 'معلقة',
    scenario: row.scenario ?? '',
    membershipId: row.membership_id ?? '',
    assignedShopperId: row.shopper_id ?? null,
    date: formatVisitDate(row.visit_date),
    time: formatVisitTime(row.visit_date),
    scores: row.scores && typeof row.scores === 'object' ? row.scores : {},
    notes: row.notes ?? '',
    pointsEarned: Number(row.points_earned ?? 0),
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

function mapNotificationRow(row) {
  return {
    id: row.id,
    recipientRole: row.recipient_role ?? '',
    recipientUserId: row.recipient_user_id ?? null,
    recipientEmail: normalizeEmail(row.recipient_email),
    title: row.title ?? '',
    description: row.description ?? '',
    eventType: row.event_type ?? '',
    visitId: row.visit_id ?? null,
    payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    isRead: Boolean(row.is_read),
    readAt: row.read_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
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

async function insertAdminRecord(insertPayload) {
  let { data, error } = await supabase.from('admins').insert([insertPayload]).select('*').single()

  if (error && Object.hasOwn(insertPayload, 'personal_email')) {
    const fallbackInsert = { ...insertPayload }
    delete fallbackInsert.personal_email

    const fallbackResult = await supabase
      .from('admins')
      .insert([fallbackInsert])
      .select('*')
      .single()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  return { data, error }
}

async function updateAdminRecord(adminId, dbUpdates) {
  let { data, error } = await supabase
    .from('admins')
    .update(dbUpdates)
    .eq('id', adminId)
    .select('*')
    .single()

  if (error && Object.hasOwn(dbUpdates, 'personal_email')) {
    const fallbackUpdates = { ...dbUpdates }
    delete fallbackUpdates.personal_email

    const fallbackResult = await supabase
      .from('admins')
      .update(fallbackUpdates)
      .eq('id', adminId)
      .select('*')
      .single()

    data = fallbackResult.data
    error = fallbackResult.error
  }

  return { data, error }
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
  const [superAdmins, setSuperAdmins] = useState([])
  const [opsAdmins, setOpsAdmins] = useState([])
  const [shoppers, setShoppers] = useState([])
  const [visits, setVisits] = useState([])
  const [issues, setIssues] = useState([])
  const [notifications, setNotifications] = useState([])
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [offices, setOffices] = useState([])
  const [evaluationCriteria, setEvaluationCriteria] = useState([])
  const [pointsRules, setPointsRules] = useState(EMPTY_POINTS_RULES)
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')

  const appBaseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin
    }

    return ''
  }, [])

  useEffect(() => {
    if (!SUPER_ADMIN_ACCOUNT.password) {
      console.warn('VITE_SUPERADMIN_PASSWORD غير معرف، تسجيل دخول السوبر أدمن سيكون معطلاً.')
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
          { data: notificationsData, error: notificationsError },
          { data: officesData, error: officesError },
          { data: criteriaData, error: criteriaError },
          { data: pointsData, error: pointsError },
        ] = await Promise.all([
          supabase.from('admins').select('*'),
          supabase.from('shoppers').select('*'),
          supabase.from('visits').select('*'),
          supabase.from('issues').select('*'),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }),
          supabase.from('offices').select('*'),
          supabase.from('evaluation_criteria').select('*').order('key'),
          supabase.from('points_rules').select('*'),
        ])

        if (adminsError) throw adminsError
        if (shoppersError) throw shoppersError
        if (visitsError) throw visitsError
        if (issuesError) throw issuesError
        if (notificationsError && !isMissingTableError(notificationsError, 'notifications')) {
          throw notificationsError
        }
        if (officesError) throw officesError
        if (criteriaError) throw criteriaError
        if (pointsError) throw pointsError

        if (mounted) {
          const mappedAdmins = (adminsData ?? []).map(mapAdminRow)
          const mappedSubAdmins = mappedAdmins.filter((admin) => admin.role === 'admin')
          const mappedSuperAdmins = mappedAdmins.filter(
            (admin) => admin.role === 'superadmin',
          )
          const mappedOpsAdmins = mappedAdmins.filter((admin) => admin.role === 'ops')
          const mappedShoppers = (shoppersData ?? []).map(mapShopperRow)
          const mappedVisits = (visitsData ?? []).map(mapVisitRow)
          const mappedIssues = (issuesData ?? []).map(mapIssueRow)
          const mappedNotifications = (notificationsData ?? []).map(mapNotificationRow)
          const mappedOffices = (officesData ?? []).map(mapOfficeRow)

          setSubAdmins(mappedSubAdmins)
          setSuperAdmins(mappedSuperAdmins)
          setOpsAdmins(mappedOpsAdmins)
          setShoppers(mappedShoppers)
          setVisits(mappedVisits)
          setIssues(mappedIssues)
          setNotifications(mappedNotifications)
          setNotificationsEnabled(!notificationsError)
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
            setSuperAdmins((previous) => previous.filter((admin) => admin.id !== payload.old.id))
            setOpsAdmins((previous) => previous.filter((admin) => admin.id !== payload.old.id))
            return
          }

          const mappedAdmin = mapAdminRow(payload.new)
          if (mappedAdmin.role === 'admin') {
            setSubAdmins((previous) => {
              const exists = previous.some((admin) => admin.id === mappedAdmin.id)
              if (!exists) return [mappedAdmin, ...previous]

              return previous.map((admin) =>
                admin.id === mappedAdmin.id ? mappedAdmin : admin,
              )
            })
            setSuperAdmins((previous) =>
              previous.filter((admin) => admin.id !== mappedAdmin.id),
            )
            setOpsAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
            return
          }

          if (mappedAdmin.role === 'superadmin') {
            setSuperAdmins((previous) => {
              const exists = previous.some((admin) => admin.id === mappedAdmin.id)
              if (!exists) return [mappedAdmin, ...previous]

              return previous.map((admin) =>
                admin.id === mappedAdmin.id ? mappedAdmin : admin,
              )
            })
            setSubAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
            setOpsAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
            return
          }

          if (mappedAdmin.role === 'ops') {
            setOpsAdmins((previous) => {
              const exists = previous.some((admin) => admin.id === mappedAdmin.id)
              if (!exists) return [mappedAdmin, ...previous]

              return previous.map((admin) =>
                admin.id === mappedAdmin.id ? mappedAdmin : admin,
              )
            })
            setSubAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
            setSuperAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
            return
          }

          setSubAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
          setSuperAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
          setOpsAdmins((previous) => previous.filter((admin) => admin.id !== mappedAdmin.id))
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

    if (notificationsEnabled) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setNotifications((previous) =>
              previous.filter((notification) => notification.id !== payload.old.id),
            )
            return
          }

          const mappedNotification = mapNotificationRow(payload.new)

          setNotifications((previous) => {
            const exists = previous.some((notification) => notification.id === mappedNotification.id)

            if (!exists) {
              return [mappedNotification, ...previous]
            }

            return previous.map((notification) =>
              notification.id === mappedNotification.id ? mappedNotification : notification,
            )
          })
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [notificationsEnabled])

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
      if (isRootSuperAdmin(authUser)) {
        return {
          ...authUser,
          personalEmail: normalizeEmail(authUser.personalEmail ?? SUPER_ADMIN_ACCOUNT.personalEmail),
          role: 'superadmin',
          isRootSuperAdmin: true,
        }
      }

      const superAdmin = superAdmins.find(
        (item) => item.id === authUser.id || normalizeEmail(item.email) === normalizeEmail(authUser.email),
      )

      if (!superAdmin || superAdmin.status !== 'نشط') {
        return null
      }

      return {
        ...authUser,
        ...superAdmin,
        role: 'superadmin',
        isRootSuperAdmin: false,
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

    if (authUser.role === 'ops') {
      const opsAdmin = opsAdmins.find(
        (item) => item.id === authUser.id || normalizeEmail(item.email) === normalizeEmail(authUser.email),
      )

      if (!opsAdmin) {
        return null
      }

      return {
        ...authUser,
        ...opsAdmin,
        role: 'ops',
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
  }, [authUser, opsAdmins, shoppers, subAdmins, superAdmins])

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

  const scopedShoppers = useMemo(() => {
    return shoppers
  }, [shoppers])

  const scopedVisits = useMemo(() => {
    return visitsWithIssues
  }, [visitsWithIssues])

  const scopedIssues = useMemo(() => {
    return issuesWithVisitMeta
  }, [issuesWithVisitMeta])

  const scopedNotifications = useMemo(() => {
    if (!activeUser) return []

    return notifications
      .filter((notification) => notification.recipientRole === activeUser.role)
      .filter(
        (notification) =>
          !notification.recipientUserId || notification.recipientUserId === activeUser.id,
      )
      .sort((first, second) => {
        const firstDate = new Date(first.createdAt).getTime()
        const secondDate = new Date(second.createdAt).getTime()
        return secondDate - firstDate
      })
  }, [activeUser, notifications])

  const unreadNotificationsCount = useMemo(() => {
    return scopedNotifications.filter((notification) => !notification.isRead).length
  }, [scopedNotifications])

  const dataLoadingValue = dataLoading
  const dataErrorValue = dataError

  const markNotificationAsRead = async (notificationId) => {
    const target = scopedNotifications.find((notification) => notification.id === notificationId)
    if (!target || target.isRead) return true

    const readAt = new Date().toISOString()

    setNotifications((previous) =>
      previous.map((notification) => {
        if (notification.id !== notificationId) return notification

        return {
          ...notification,
          isRead: true,
          readAt,
        }
      }),
    )

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: readAt,
      })
      .eq('id', notificationId)

    if (error) {
      console.error('Failed to mark notification as read:', error)
      return false
    }

    return true
  }

  const markAllNotificationsAsRead = async () => {
    const targetIds = scopedNotifications
      .filter((notification) => !notification.isRead)
      .map((notification) => notification.id)

    if (targetIds.length === 0) return true

    const readAt = new Date().toISOString()

    const idsSet = new Set(targetIds)
    setNotifications((previous) =>
      previous.map((notification) => {
        if (!idsSet.has(notification.id)) return notification

        return {
          ...notification,
          isRead: true,
          readAt,
        }
      }),
    )

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: readAt,
      })
      .in('id', targetIds)

    if (error) {
      console.error('Failed to mark all notifications as read:', error)
      return false
    }

    return true
  }

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
    if (activeUser.role === 'ops') return true
    if (activeUser.role === 'admin') return true
    return false
  }

  const canAssignVisitShopper = () => {
    return activeUser?.role === 'superadmin' || activeUser?.role === 'ops'
  }

  const notificationRecipientsByRole = useMemo(() => {
    const superadminRecipients = superAdmins
      .filter((admin) => admin.status === 'نشط')
      .map((admin) => ({
        id: admin.id,
        role: 'superadmin',
        name: admin.name,
        email: notificationEmailForUser(admin),
      }))

    const rootSuperAdminEmail = normalizeEmail(
      SUPER_ADMIN_ACCOUNT.personalEmail || SUPER_ADMIN_ACCOUNT.email,
    )

    if (rootSuperAdminEmail) {
      superadminRecipients.push({
        id: SUPER_ADMIN_ACCOUNT.id,
        role: 'superadmin',
        name: SUPER_ADMIN_ACCOUNT.name,
        email: rootSuperAdminEmail,
      })
    }

    const adminRecipients = subAdmins
      .filter((admin) => admin.status === 'نشط')
      .map((admin) => ({
        id: admin.id,
        role: 'admin',
        name: admin.name,
        email: notificationEmailForUser(admin),
      }))

    const opsRecipients = opsAdmins
      .filter((admin) => admin.status === 'نشط')
      .map((admin) => ({
        id: admin.id,
        role: 'ops',
        name: admin.name,
        email: notificationEmailForUser(admin),
      }))

    return {
      superadmins: dedupeNotificationRecipients(superadminRecipients),
      admins: dedupeNotificationRecipients(adminRecipients),
      ops: dedupeNotificationRecipients(opsRecipients),
    }
  }, [opsAdmins, subAdmins, superAdmins])

  const shoppersById = useMemo(() => {
    return new Map(shoppers.map((shopper) => [shopper.id, shopper]))
  }, [shoppers])

  const serializeVisitForNotification = (visit) => {
    if (!visit) return null

    const assignedShopper = visit.assignedShopperId ? shoppersById.get(visit.assignedShopperId) : null

    return {
      id: visit.id,
      officeName: visit.officeName,
      city: visit.city,
      date: visit.date,
      time: visit.time,
      status: visit.status,
      scenario: visit.scenario,
      membershipId: visit.membershipId,
      assignedShopperId: visit.assignedShopperId,
      assignedShopperName: assignedShopper?.name ?? null,
    }
  }

  const createInAppVisitNotifications = async ({
    eventType,
    visit,
    previousVisit,
    actor,
    recipients,
  }) => {
    if (!notificationsEnabled || !eventType || !visit?.id) return 0

    const finalRecipients = dedupeNotificationRecipients(recipients)
    if (finalRecipients.length === 0) return 0

    const inAppAudience = []
    const seenAudience = new Set()

    finalRecipients.forEach((recipient) => {
      const role = String(recipient?.role ?? '').trim()
      if (!role) return

      const userId = String(recipient?.id ?? '').trim()
      const email = normalizeEmail(recipient?.email)
      const isShopper = role === 'shopper'
      const audienceKey = isShopper ? `shopper:${userId || email}` : `${role}:all`

      if (!audienceKey || seenAudience.has(audienceKey)) return

      seenAudience.add(audienceKey)
      inAppAudience.push({
        role,
        id: isShopper ? userId || null : null,
        name: recipient?.name ?? '',
        email,
      })
    })

    if (inAppAudience.length === 0) return 0

    const rows = inAppAudience.map((recipient) => {
      const content = getInAppNotificationContent(eventType, visit, recipient.role)

      return {
        recipient_role: recipient.role,
        recipient_user_id: String(recipient.id ?? '').trim() || null,
        recipient_email: normalizeEmail(recipient.email),
        title: content.title,
        description: content.description,
        event_type: eventType,
        visit_id: visit.id,
        payload: {
          visit: serializeVisitForNotification(visit),
          previousVisit: serializeVisitForNotification(previousVisit),
          actor,
          recipient: {
            id: String(recipient.id ?? '').trim() || null,
            role: recipient.role,
            name: recipient.name ?? '',
          },
        },
      }
    })

    const { error } = await supabase.from('notifications').insert(rows)

    if (error) {
      console.error('Failed to create in-app notifications:', error)
      return 0
    }

    return rows.length
  }

  const notifyVisitEvent = async ({ eventType, visit, previousVisit = null, recipients = [] }) => {
    if (!eventType || !visit) {
      return { inAppCreated: 0, sent: 0, failed: 0, failures: [] }
    }

    const finalRecipients = dedupeNotificationRecipients(recipients)

    if (finalRecipients.length === 0) {
      return { inAppCreated: 0, sent: 0, failed: 0, failures: [] }
    }

    const actor = activeUser
      ? {
          id: activeUser.id,
          name: activeUser.name,
          role: activeUser.role,
          email: activeUser.email,
          personalEmail: activeUser.personalEmail ?? '',
        }
      : null

    const payload = {
      eventType,
      visit: serializeVisitForNotification(visit),
      previousVisit: serializeVisitForNotification(previousVisit),
      actor,
      recipients: dedupeRecipientsByEmail(finalRecipients),
      appBaseUrl,
    }

    const inAppCreated = await createInAppVisitNotifications({
      eventType,
      visit,
      previousVisit,
      actor,
      recipients: finalRecipients,
    })

    if (payload.recipients.length === 0) {
      return { inAppCreated, sent: 0, failed: 0, failures: [] }
    }

    const authHeaders = {}

    if (looksLikeJwt(SUPABASE_FUNCTIONS_AUTH_TOKEN)) {
      authHeaders.Authorization = `Bearer ${SUPABASE_FUNCTIONS_AUTH_TOKEN}`
    }

    const invokeOptions = {
      body: payload,
      ...(Object.keys(authHeaders).length > 0 ? { headers: authHeaders } : {}),
    }

    const { data, error } = await supabase.functions.invoke('send-visit-notification', invokeOptions)

    if (!error) {
      const sent = Number(data?.sent ?? 0)
      const failed = Number(data?.failed ?? 0)
      const failures = Array.isArray(data?.failures) ? data.failures : []

      if (failed > 0) {
        console.error('Visit notification returned recipient failures:', failures)
      }

      return { inAppCreated, sent, failed, failures }
    }

    console.error('Failed to send visit notification through SDK invoke:', error)

    if (!SUPABASE_FUNCTIONS_ENDPOINT || !SUPABASE_FUNCTIONS_PUBLIC_KEY) {
      return {
        sent: 0,
        inAppCreated,
        failed: payload.recipients.length,
        failures: [{ error: 'Function fallback endpoint or public key is missing' }],
      }
    }

    try {
      const fallbackHeaders = {
        apikey: SUPABASE_FUNCTIONS_PUBLIC_KEY,
        'Content-Type': 'application/json',
        ...(authHeaders.Authorization ? { Authorization: authHeaders.Authorization } : {}),
      }

      const response = await fetch(SUPABASE_FUNCTIONS_ENDPOINT, {
        method: 'POST',
        headers: fallbackHeaders,
        body: JSON.stringify(payload),
      })

      const rawBody = await response.text()
      const parsedBody = rawBody ? JSON.parse(rawBody) : null

      if (!response.ok) {
        throw new Error(parsedBody?.error || rawBody || `HTTP ${response.status}`)
      }

      const sent = Number(parsedBody?.sent ?? 0)
      const failed = Number(parsedBody?.failed ?? 0)
      const failures = Array.isArray(parsedBody?.failures) ? parsedBody.failures : []

      if (failed > 0) {
        console.error('Visit notification fallback returned recipient failures:', failures)
      }

      return { inAppCreated, sent, failed, failures }
    } catch (fallbackError) {
      console.error('Failed to send visit notification through fallback request:', fallbackError)
      return {
        sent: 0,
        inAppCreated,
        failed: payload.recipients.length,
        failures: [
          {
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : 'Unknown notification fallback error',
          },
        ],
      }
    }
  }

  const handleLogin = (email, password, options = {}) => {
    const commitSession = options.commit !== false
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
        personalEmail: normalizeEmail(SUPER_ADMIN_ACCOUNT.personalEmail),
        role: 'superadmin',
      }

      if (commitSession) {
        setAuthUser(payload)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      }
      return payload
    }

    const managedSuperAdmin = superAdmins.find(
      (item) =>
        normalizeEmail(item.email) === normalizedEmail &&
        item.password === password &&
        item.status === 'نشط',
    )

    if (managedSuperAdmin) {
      const payload = {
        id: managedSuperAdmin.id,
        name: managedSuperAdmin.name,
        email: managedSuperAdmin.email,
        personalEmail: managedSuperAdmin.personalEmail ?? '',
        role: 'superadmin',
      }

      if (commitSession) {
        setAuthUser(payload)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      }
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
        personalEmail: subAdmin.personalEmail ?? '',
        role: 'admin',
        assignedShopperIds: subAdmin.assignedShopperIds ?? [],
      }

      if (commitSession) {
        setAuthUser(payload)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      }
      return payload
    }

    const opsAdmin = opsAdmins.find(
      (item) =>
        normalizeEmail(item.email) === normalizedEmail &&
        item.password === password &&
        item.status === 'نشط',
    )

    if (opsAdmin) {
      const payload = {
        id: opsAdmin.id,
        name: opsAdmin.name,
        email: opsAdmin.email,
        personalEmail: opsAdmin.personalEmail ?? '',
        role: 'ops',
      }

      if (commitSession) {
        setAuthUser(payload)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      }
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
        personalEmail: shopper.personalEmail ?? '',
        role: 'shopper',
      }

      if (commitSession) {
        setAuthUser(payload)
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
      }
      return payload
    }

    return null
  }

  const handleLogout = () => {
    setAuthUser(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }

  const canManageSuperAdmins = isRootSuperAdmin(activeUser)
  const canManageOpsAdmins = activeUser?.role === 'superadmin'

  const addSuperAdmin = async (payload) => {
    if (!canManageSuperAdmins) return null

    const insertPayload = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      personal_email: normalizeEmail(payload.personalEmail),
      password: payload.password,
      city: payload.city.trim(),
      status: toDbUserStatus(payload.status),
      role: 'superadmin',
      assigned_shopper_ids: [],
    }

    const { data: insertedAdmin, error } = await insertAdminRecord(insertPayload)

    if (error || !insertedAdmin) {
      console.error('Error adding super admin:', error)
      return null
    }

    const nextSuperAdmin = mapAdminRow(insertedAdmin)

    setSuperAdmins((previous) => [nextSuperAdmin, ...previous])
    return nextSuperAdmin
  }

  const updateSuperAdmin = async (superAdminId, updates) => {
    if (!canManageSuperAdmins) return null

    const currentAdmin = superAdmins.find((admin) => admin.id === superAdminId)
    if (!currentAdmin) return null

    const dbUpdates = {
      name: updates.name ? updates.name.trim() : currentAdmin.name,
      email: updates.email ? normalizeEmail(updates.email) : currentAdmin.email,
      personal_email:
        updates.personalEmail !== undefined
          ? normalizeEmail(updates.personalEmail)
          : currentAdmin.personalEmail,
      password: updates.password ?? currentAdmin.password,
      city: updates.city ? updates.city.trim() : currentAdmin.city,
      status: updates.status ? toDbUserStatus(updates.status) : toDbUserStatus(currentAdmin.status),
    }

    const { data: updatedAdminRow, error } = await updateAdminRecord(superAdminId, dbUpdates)

    if (error || !updatedAdminRow) {
      console.error('Error updating super admin:', error)
      return null
    }

    const updatedItem = mapAdminRow(updatedAdminRow)

    setSuperAdmins((previous) =>
      previous.map((item) => (item.id === superAdminId ? updatedItem : item)),
    )

    if (updatedItem && authUser?.role === 'superadmin' && authUser.id === superAdminId) {
      const refreshedAuth = {
        ...authUser,
        ...updatedItem,
        role: 'superadmin',
      }
      setAuthUser(refreshedAuth)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedAuth))
    }

    return updatedItem
  }

  const deleteSuperAdmin = async (superAdminId) => {
    if (!canManageSuperAdmins || superAdminId === SUPER_ADMIN_ACCOUNT.id) return false

    const { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', superAdminId)
      .eq('role', 'superadmin')

    if (error) {
      console.error('Error deleting super admin:', error)
      return false
    }

    setSuperAdmins((previous) => previous.filter((item) => item.id !== superAdminId))

    if (authUser?.role === 'superadmin' && authUser.id === superAdminId) {
      handleLogout()
    }

    return true
  }

  const addOpsAdmin = async (payload) => {
    if (activeUser?.role !== 'superadmin') return null

    const insertPayload = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      personal_email: normalizeEmail(payload.personalEmail),
      password: payload.password,
      city: payload.city.trim(),
      status: toDbUserStatus(payload.status),
      role: 'ops',
      assigned_shopper_ids: [],
    }

    const { data: insertedAdmin, error } = await insertAdminRecord(insertPayload)

    if (error || !insertedAdmin) {
      console.error('Error adding ops admin:', error)
      return null
    }

    const nextOpsAdmin = mapAdminRow(insertedAdmin)
    setOpsAdmins((previous) => [nextOpsAdmin, ...previous])

    return nextOpsAdmin
  }

  const updateOpsAdmin = async (opsAdminId, updates) => {
    if (activeUser?.role !== 'superadmin') return null

    const currentAdmin = opsAdmins.find((admin) => admin.id === opsAdminId)
    if (!currentAdmin) return null

    const dbUpdates = {
      name: updates.name ? updates.name.trim() : currentAdmin.name,
      email: updates.email ? normalizeEmail(updates.email) : currentAdmin.email,
      personal_email:
        updates.personalEmail !== undefined
          ? normalizeEmail(updates.personalEmail)
          : currentAdmin.personalEmail,
      password: updates.password ?? currentAdmin.password,
      city: updates.city ? updates.city.trim() : currentAdmin.city,
      status: updates.status ? toDbUserStatus(updates.status) : toDbUserStatus(currentAdmin.status),
    }

    const { data: updatedAdminRow, error } = await updateAdminRecord(opsAdminId, dbUpdates)

    if (error || !updatedAdminRow) {
      console.error('Error updating ops admin:', error)
      return null
    }

    const updatedItem = mapAdminRow(updatedAdminRow)
    setOpsAdmins((previous) =>
      previous.map((item) => (item.id === opsAdminId ? updatedItem : item)),
    )

    if (authUser?.role === 'ops' && authUser.id === opsAdminId) {
      const refreshedAuth = {
        ...authUser,
        ...updatedItem,
        role: 'ops',
      }
      setAuthUser(refreshedAuth)
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshedAuth))
    }

    return updatedItem
  }

  const deleteOpsAdmin = async (opsAdminId) => {
    if (activeUser?.role !== 'superadmin') return false

    const { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', opsAdminId)
      .eq('role', 'ops')

    if (error) {
      console.error('Error deleting ops admin:', error)
      return false
    }

    setOpsAdmins((previous) => previous.filter((item) => item.id !== opsAdminId))

    if (authUser?.role === 'ops' && authUser.id === opsAdminId) {
      handleLogout()
    }

    return true
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
      personal_email: normalizeEmail(payload.personalEmail),
      password: payload.password,
      city: payload.city.trim(),
      status: toDbUserStatus(payload.status),
      role: 'admin',
      assigned_shopper_ids: validAssigned,
    }

    const { data: insertedAdmin, error } = await insertAdminRecord(insertPayload)

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
      personal_email:
        updates.personalEmail !== undefined
          ? normalizeEmail(updates.personalEmail)
          : currentAdmin.personalEmail,
      password: updates.password ?? currentAdmin.password,
      city: updates.city ? updates.city.trim() : currentAdmin.city,
      status: updates.status ? toDbUserStatus(updates.status) : toDbUserStatus(currentAdmin.status),
      assigned_shopper_ids: validAssigned,
    }

    const { data: updatedAdminRow, error } = await updateAdminRecord(subAdminId, dbUpdates)

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
    if (activeUser?.role !== 'superadmin') {
      return null
    }

    const dbStatus = toDbUserStatus(payload.status)

    const baseShopperData = {
      name: payload.name.trim(),
      email: normalizeEmail(payload.email),
      password: payload.password,
      city: payload.city.trim(),
      visits_completed: 0,
      points: 0,
      status: dbStatus,
      assigned_admin_id: null,
    }

    const shopperDataWithContacts = {
      ...baseShopperData,
      personal_email: normalizeEmail(payload.personalEmail),
      primary_phone: String(payload.primaryPhone ?? '').trim(),
      whatsapp_phone: String(payload.whatsappPhone ?? '').trim(),
    }

    let { data: dbShopper, error } = await supabase
      .from('shoppers')
      .insert([shopperDataWithContacts])
      .select()
      .single()

    if (error) {
      const { data: fallbackShopper, error: fallbackError } = await supabase
        .from('shoppers')
        .insert([baseShopperData])
        .select()
        .single()

      dbShopper = fallbackShopper
      error = fallbackError
    }

    if (error || !dbShopper) {
      console.error('Error adding shopper:', error)
      return null
    }

    const nextShopper = mapShopperRow(dbShopper)

    setShoppers((previous) => [nextShopper, ...previous])

    return nextShopper
  }

  const updateShopper = async (shopperId, updates) => {
    if (!canManageShopper(shopperId)) return null

    const dbUpdates = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim()
    if (updates.email !== undefined) dbUpdates.email = normalizeEmail(updates.email)
    if (updates.city !== undefined) dbUpdates.city = updates.city.trim()
    if (updates.password !== undefined) dbUpdates.password = updates.password
    if (updates.status) {
      dbUpdates.status = toDbUserStatus(updates.status)
    }

    if (updates.primaryPhone !== undefined) {
      dbUpdates.primary_phone = String(updates.primaryPhone ?? '').trim()
    }

    if (updates.whatsappPhone !== undefined) {
      dbUpdates.whatsapp_phone = String(updates.whatsappPhone ?? '').trim()
    }

    if (updates.personalEmail !== undefined) {
      dbUpdates.personal_email = normalizeEmail(updates.personalEmail)
    }

    let { data: dbShopper, error } = await supabase
      .from('shoppers')
      .update(dbUpdates)
      .eq('id', shopperId)
      .select()
      .single()

    if (
      error &&
      (Object.hasOwn(dbUpdates, 'primary_phone') ||
        Object.hasOwn(dbUpdates, 'whatsapp_phone') ||
        Object.hasOwn(dbUpdates, 'personal_email'))
    ) {
      const fallbackUpdates = { ...dbUpdates }
      delete fallbackUpdates.primary_phone
      delete fallbackUpdates.whatsapp_phone
      delete fallbackUpdates.personal_email

      const fallbackResult = await supabase
        .from('shoppers')
        .update(fallbackUpdates)
        .eq('id', shopperId)
        .select()
        .single()

      dbShopper = fallbackResult.data
      error = fallbackResult.error
    }

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
    if (!activeUser || !['superadmin', 'admin', 'ops'].includes(activeUser.role)) return null

    const requestedShopperId = payload.assignedShopperId ?? null
    const canAssign = canAssignVisitShopper()

    if (requestedShopperId && !canAssign) {
      return null
    }

    if (requestedShopperId && !shoppers.some((shopper) => shopper.id === requestedShopperId)) {
      return null
    }

    const dbPayload = {
      office_name: payload.officeName.trim(),
      city: payload.city.trim(),
      type: payload.type ?? 'عام',
      status: payload.status ?? 'معلقة',
      scenario: payload.scenario?.trim() ?? '',
      membership_id: payload.membershipId?.trim() || generateMembershipId(),
      shopper_id: requestedShopperId,
      visit_date: parseVisitDateTime(payload.date, payload.time),
      scores: payload.scores ?? makeEmptyScores(evaluationCriteria),
      notes: payload.notes ?? '',
      points_earned: payload.pointsEarned ?? 0,
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

    const adminRoleRecipients = dedupeNotificationRecipients([
      ...notificationRecipientsByRole.superadmins,
      ...notificationRecipientsByRole.admins,
      ...notificationRecipientsByRole.ops,
    ])

    const creationNotification = await notifyVisitEvent({
      eventType: 'visit_created',
      visit: nextVisit,
      recipients: adminRoleRecipients,
    })

    if (creationNotification.failed > 0) {
      const firstFailure = String(creationNotification.failures?.[0]?.error ?? '')

      if (isResendTestingRestrictionError(firstFailure)) {
        window.alert(
          'تم حفظ الزيارة وإشعار الموقع، لكن البريد مرفوض من Resend في وضع الاختبار. يلزم توثيق Domain في Resend وتعيين RESEND_FROM_EMAIL من نفس الدومين.',
        )
      } else if (creationNotification.sent === 0) {
        window.alert('تم حفظ الزيارة لكن تعذر إرسال إشعار البريد الإلكتروني.')
      } else {
        window.alert('تم حفظ الزيارة وإرسال جزء من البريد، لكن بعض المستلمين فشل لهم الإرسال.')
      }
    }

    if (nextVisit.assignedShopperId) {
      const assignedShopper = shoppersById.get(nextVisit.assignedShopperId)
      const shopperEmail = notificationEmailForUser(assignedShopper)

      const assignedNotification = await notifyVisitEvent({
        eventType: 'visit_assigned',
        visit: nextVisit,
        recipients: [
          {
            id: assignedShopper?.id,
            role: 'shopper',
            name: assignedShopper?.name ?? '',
            email: shopperEmail,
          },
        ],
      })

      if (assignedNotification.failed > 0 && assignedNotification.sent === 0) {
        const firstFailure = String(assignedNotification.failures?.[0]?.error ?? '')

        if (isResendTestingRestrictionError(firstFailure)) {
          window.alert(
            'تم حفظ الزيارة لكن إشعار البريد للمتسوق مرفوض بسبب Resend test mode. يلزم توثيق Domain في Resend.',
          )
        }

        console.error('Failed to deliver assigned-shopper notification:', assignedNotification.failures)
      }
    }

    return nextVisit
  }

  const updateVisit = async (visitId, updates) => {
    if (!activeUser || !['superadmin', 'admin', 'ops', 'shopper'].includes(activeUser.role)) return null

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
    if (updates.assignedShopperId !== undefined) {
      if (!canAssignVisitShopper()) return null
      dbUpdates.shopper_id = updates.assignedShopperId || null
    }
    if (updates.scores !== undefined) dbUpdates.scores = updates.scores
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes
    if (updates.pointsEarned !== undefined) dbUpdates.points_earned = updates.pointsEarned

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

    const adminRoleRecipients = dedupeNotificationRecipients([
      ...notificationRecipientsByRole.superadmins,
      ...notificationRecipientsByRole.admins,
      ...notificationRecipientsByRole.ops,
    ])

    const changedKeys = Object.keys(dbUpdates)
    const assignmentChanged = targetVisit.assignedShopperId !== updatedVisit.assignedShopperId
    const isReassigned =
      Boolean(targetVisit.assignedShopperId) &&
      Boolean(updatedVisit.assignedShopperId) &&
      targetVisit.assignedShopperId !== updatedVisit.assignedShopperId

    if (isReassigned) {
      void notifyVisitEvent({
        eventType: 'visit_reassigned',
        visit: updatedVisit,
        previousVisit: targetVisit,
        recipients: adminRoleRecipients,
      })
    }

    if (assignmentChanged && updatedVisit.assignedShopperId) {
      const assignedShopper = shoppersById.get(updatedVisit.assignedShopperId)
      const shopperEmail = notificationEmailForUser(assignedShopper)

      void notifyVisitEvent({
        eventType: 'visit_assigned',
        visit: updatedVisit,
        previousVisit: targetVisit,
        recipients: [
          {
            id: assignedShopper?.id,
            role: 'shopper',
            name: assignedShopper?.name ?? '',
            email: shopperEmail,
          },
        ],
      })
    }

    const statusBecameCompleted =
      targetVisit.status !== 'مكتملة' && updatedVisit.status === 'مكتملة'

    if (statusBecameCompleted) {
      void notifyVisitEvent({
        eventType: 'visit_completed',
        visit: updatedVisit,
        previousVisit: targetVisit,
        recipients: adminRoleRecipients,
      })
    } else {
      const hasNonAssignmentChanges = changedKeys.some((key) => key !== 'shopper_id')

      if (hasNonAssignmentChanges) {
        void notifyVisitEvent({
          eventType: 'visit_updated',
          visit: updatedVisit,
          previousVisit: targetVisit,
          recipients: adminRoleRecipients,
        })
      }
    }

    return updatedVisit
  }

  const deleteVisit = async (visitId) => {
    const target = visits.find((item) => item.id === visitId)
    if (!target || (!canManageVisit(target) && activeUser?.role !== 'superadmin')) {
      return false
    }

    if (activeUser?.role === 'ops') {
      const { data: requestedVisitRow, error: requestError } = await supabase
        .from('visits')
        .update({ status: 'جاري المسح' })
        .eq('id', visitId)
        .select('*')
        .single()

      if (requestError || !requestedVisitRow) {
        console.error('Error requesting visit deletion:', requestError)
        return false
      }

      const requestedVisit = mapVisitRow(requestedVisitRow)
      setVisits((previous) =>
        previous.map((visit) => (visit.id === visitId ? requestedVisit : visit)),
      )

      void notifyVisitEvent({
        eventType: 'visit_delete_requested',
        visit: requestedVisit,
        previousVisit: target,
        recipients: notificationRecipientsByRole.superadmins,
      })

      return 'requested'
    }

    if (activeUser?.role === 'admin') {
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
      issueSeverity: generatedIssues.map((issue) => issue.severity),
      hasComprehensiveReport: String(payload.notes ?? '').trim().length >= 30,
      isFastCompletion: true,
      hasAccurateInfo: finalScore >= 3.5,
      completedVisits: completedVisitsCount,
    })

    const finalVisitPoints = pointsEarned

    const previousPoints = wasCompleted
      ? Number(targetVisit.pointsEarned ?? 0)
      : 0

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

    const completedVisit = mapVisitRow(updatedVisitRow)
    const adminRoleRecipients = dedupeNotificationRecipients([
      ...notificationRecipientsByRole.superadmins,
      ...notificationRecipientsByRole.admins,
      ...notificationRecipientsByRole.ops,
    ])

    void notifyVisitEvent({
      eventType: 'visit_completed',
      visit: completedVisit,
      previousVisit: targetVisit,
      recipients: adminRoleRecipients,
    })

    return finalVisitPoints
  }

  const adminScopeProps = {
    user: activeUser,
    shoppers: scopedShoppers,
    visits: scopedVisits,
    issues: scopedIssues,
    offices,
    evaluationCriteria,
    pointsRules,
    notifications: scopedNotifications,
    notificationsEnabled,
    unreadNotificationsCount,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    isLive: true,
    adminHasAssignments: true,
    addShopper,
    updateShopper,
    updateShopperStatus,
    deleteShopper,
    addVisit,
    updateVisit,
    deleteVisit,
    completeVisit,
    awardShopperPoints,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    onLogout: handleLogout,
  }

  const opsScopeProps = {
    user: activeUser,
    shoppers,
    visits: visitsWithIssues,
    issues: issuesWithVisitMeta,
    offices,
    evaluationCriteria,
    pointsRules,
    notifications: scopedNotifications,
    notificationsEnabled,
    unreadNotificationsCount,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    isLive: true,
    addVisit,
    updateVisit,
    deleteVisit,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    onLogout: handleLogout,
  }

  const superAdminScopeProps = {
    user: activeUser,
    superAdmins,
    opsAdmins,
    subAdmins,
    shoppers,
    visits: visitsWithIssues,
    issues: issuesWithVisitMeta,
    offices,
    evaluationCriteria,
    pointsRules,
    notifications: scopedNotifications,
    notificationsEnabled,
    unreadNotificationsCount,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    isLive: true,
    canManageSuperAdmins,
    canManageOpsAdmins,
    addSuperAdmin,
    updateSuperAdmin,
    deleteSuperAdmin,
    addOpsAdmin,
    updateOpsAdmin,
    deleteOpsAdmin,
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
    markNotificationAsRead,
    markAllNotificationsAsRead,
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
    notifications: scopedNotifications,
    notificationsEnabled,
    unreadNotificationsCount,
    dataLoading: dataLoadingValue,
    dataError: dataErrorValue,
    completeVisit,
    markNotificationAsRead,
    markAllNotificationsAsRead,
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
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="reports" element={<AdminReports />} />
          {SHOW_POINTS_SECTION && <Route path="points" element={<Points />} />}
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
          <Route path="visits" element={<Visits />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="reports" element={<AdminReports />} />
          {SHOW_POINTS_SECTION && <Route path="points" element={<Points />} />}
        </Route>

        <Route
          path="/ops"
          element={
            <ProtectedRoute user={activeUser} allowedRole="ops">
              <AdminLayout {...opsScopeProps} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="visits" element={<Visits />} />
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="reports" element={<AdminReports />} />
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
          <Route path="notifications" element={<NotificationCenter />} />
          <Route path="reports" element={<ShopperReports />} />
        </Route>

        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
