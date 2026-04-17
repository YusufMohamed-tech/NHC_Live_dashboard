const COUNT_KEYWORDS = ['كم', 'عدد', 'how many', 'count', 'total']
const LATEST_KEYWORDS = ['latest', 'last', 'recent', 'اخر', 'آخر', 'حديثة']
const TODAY_KEYWORDS = ['today', 'اليوم', 'النهارده', 'نهارده']
const YESTERDAY_KEYWORDS = ['yesterday', 'امس', 'أمس']
const THIS_WEEK_KEYWORDS = ['this week', 'الاسبوع', 'الأسبوع']
const THIS_MONTH_KEYWORDS = ['this month', 'هذا الشهر']

const VISIT_DOMAIN_KEYWORDS = [
  'زيارة',
  'زيارات',
  'visit',
  'visits',
  'dashboard',
  'داشبورد',
  'مدينة',
  'city',
  'فرع',
  'office',
  'متسوق',
  'shopper',
  'حالة',
  'status',
  'معلقة',
  'قادمة',
  'مكتملة',
  'مسح',
  'count',
  'total',
  'عدد',
  'كم',
  'latest',
  'last',
  'recent',
  'اخر',
  'آخر',
  'today',
  'yesterday',
  'this week',
  'this month',
  'اليوم',
  'النهارده',
  'نهارده',
  'امس',
  'أمس',
  'الاسبوع',
  'الأسبوع',
  'الشهر',
]

const STATUS_KEYWORDS = {
  معلقة: ['معلقة', 'معلقه', 'pending', 'new visit', 'new'],
  قادمة: ['قادمة', 'قادمه', 'upcoming', 'revisit', 'follow-up'],
  مكتملة: ['مكتملة', 'مكتمله', 'completed', 'done', 'finished'],
  'جاري المسح': ['جاري المسح', 'مسح', 'delete request', 'deleting'],
}

const DEFAULT_SUGGESTIONS = [
  'كم عدد الزيارات المعلقة اليوم؟',
  'اعرض آخر 5 زيارات',
  'اعرض الزيارات المكتملة هذا الأسبوع',
  'زيارات مدينة الرياض',
]

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
}

function toDateKey(dateValue) {
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayDateKey() {
  return toDateKey(new Date())
}

function yesterdayDateKey() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateKey(date)
}

function weekRange() {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const start = new Date(now)
  start.setDate(now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function hasAnyKeyword(question, keywords) {
  return keywords.some((keyword) => normalizeText(question).includes(normalizeText(keyword)))
}

function detectStatus(question) {
  const normalizedQuestion = normalizeText(question)

  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some((keyword) => normalizedQuestion.includes(normalizeText(keyword)))) {
      return status
    }
  }

  return null
}

function detectDateFilter(question) {
  const normalizedQuestion = normalizeText(question)

  const explicitDate = normalizedQuestion.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (explicitDate) {
    return { type: 'date', value: explicitDate[1] }
  }

  if (hasAnyKeyword(normalizedQuestion, TODAY_KEYWORDS)) {
    return { type: 'date', value: todayDateKey() }
  }

  if (hasAnyKeyword(normalizedQuestion, YESTERDAY_KEYWORDS)) {
    return { type: 'date', value: yesterdayDateKey() }
  }

  if (hasAnyKeyword(normalizedQuestion, THIS_WEEK_KEYWORDS)) {
    return { type: 'week', value: weekRange() }
  }

  if (hasAnyKeyword(normalizedQuestion, THIS_MONTH_KEYWORDS)) {
    return { type: 'month', value: monthRange() }
  }

  return null
}

function extractVisitId(question) {
  const uuid = String(question ?? '').match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  )
  return uuid ? uuid[0] : null
}

function extractLimit(question, fallback = 5, maxLimit = 20) {
  const normalizedQuestion = normalizeText(question)
  const match = normalizedQuestion.match(/(?:اخر|آخر|last|latest)\s+(\d{1,2})/)
  if (!match) return fallback

  const value = Number(match[1])
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(maxLimit, value))
}

function getVisitDateObject(visit) {
  const dateKey = String(visit?.date ?? '').trim()
  if (!dateKey) return new Date(0)

  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return new Date(0)
  return date
}

function sortNewest(visits) {
  return [...visits].sort((first, second) => getVisitDateObject(second) - getVisitDateObject(first))
}

function formatVisitLine(visit, shopperName = '') {
  const pieces = [
    visit.id ? `#${visit.id}` : null,
    visit.officeName,
    visit.city,
    visit.date,
    visit.time,
    visit.status,
  ].filter(Boolean)

  if (shopperName) {
    pieces.push(`المتسوق: ${shopperName}`)
  }

  return pieces.join(' | ')
}

function applyDateFilter(visits, dateFilter) {
  if (!dateFilter) return visits

  if (dateFilter.type === 'date') {
    return visits.filter((visit) => String(visit.date ?? '').trim() === dateFilter.value)
  }

  if (dateFilter.type === 'week' || dateFilter.type === 'month') {
    const { start, end } = dateFilter.value
    return visits.filter((visit) => {
      const date = getVisitDateObject(visit)
      return date >= start && date <= end
    })
  }

  return visits
}

function detectEntityMatch(question, visits, shoppersById) {
  const normalizedQuestion = normalizeText(question)

  const citySet = Array.from(new Set(visits.map((visit) => String(visit.city ?? '').trim()).filter(Boolean)))
  const city = citySet.find((item) => normalizedQuestion.includes(normalizeText(item))) || null

  const officeSet = Array.from(
    new Set(visits.map((visit) => String(visit.officeName ?? '').trim()).filter(Boolean)),
  )
  const office =
    officeSet.find((item) => normalizeText(item).length >= 3 && normalizedQuestion.includes(normalizeText(item))) ||
    null

  const shopperEntries = Array.from(shoppersById.entries())
  const shopperEntry = shopperEntries.find(([, shopper]) => {
    const name = normalizeText(shopper?.name)
    return name && name.length >= 2 && normalizedQuestion.includes(name)
  })

  return {
    city,
    office,
    shopperId: shopperEntry ? shopperEntry[0] : null,
    shopperName: shopperEntry ? shopperEntry[1]?.name ?? '' : '',
  }
}

function buildSummary(visits) {
  const total = visits.length
  const completed = visits.filter((visit) => visit.status === 'مكتملة').length
  const pending = visits.filter((visit) => visit.status === 'معلقة').length
  const upcoming = visits.filter((visit) => visit.status === 'قادمة').length
  const deleting = visits.filter((visit) => visit.status === 'جاري المسح').length

  return `ملخص الزيارات: الإجمالي ${total} | المعلقة ${pending} | القادمة ${upcoming} | المكتملة ${completed} | جاري المسح ${deleting}`
}

function isVisitDomainQuestion(question) {
  return hasAnyKeyword(question, VISIT_DOMAIN_KEYWORDS)
}

export function summarizeVisitsForModel(visits, shoppersById, limit = 80) {
  return sortNewest(visits)
    .slice(0, limit)
    .map((visit) => ({
      id: visit.id,
      officeName: visit.officeName,
      city: visit.city,
      date: visit.date,
      time: visit.time,
      status: visit.status,
      scenario: visit.scenario,
      assignedShopperId: visit.assignedShopperId,
      assignedShopperName: shoppersById.get(visit.assignedShopperId)?.name ?? null,
    }))
}

export function runVisitAssistant({ question, visits = [], shoppers = [] }) {
  const safeQuestion = String(question ?? '').trim()
  const normalizedQuestion = normalizeText(safeQuestion)

  if (!safeQuestion) {
    return {
      intent: 'empty',
      answer: 'اكتب سؤالك عن الزيارات وسأجيبك مباشرة.',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const shoppersById = new Map((shoppers ?? []).map((shopper) => [shopper.id, shopper]))
  const allVisits = Array.isArray(visits) ? visits : []

  const visitId = extractVisitId(safeQuestion)
  if (visitId) {
    const found = allVisits.find((visit) => String(visit.id).toLowerCase() === visitId.toLowerCase())
    if (!found) {
      return {
        intent: 'visit_by_id',
        answer: `لم أجد زيارة بالمعرف ${visitId}.`,
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }

    const shopperName = shoppersById.get(found.assignedShopperId)?.name ?? ''
    return {
      intent: 'visit_by_id',
      answer: `تم العثور على الزيارة: ${formatVisitLine(found, shopperName)}`,
      matchedVisits: [found],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const status = detectStatus(safeQuestion)
  const dateFilter = detectDateFilter(safeQuestion)
  const entities = detectEntityMatch(safeQuestion, allVisits, shoppersById)

  let filtered = [...allVisits]

  if (status) {
    filtered = filtered.filter((visit) => visit.status === status)
  }

  if (entities.city) {
    filtered = filtered.filter((visit) => normalizeText(visit.city) === normalizeText(entities.city))
  }

  if (entities.office) {
    filtered = filtered.filter(
      (visit) => normalizeText(visit.officeName) === normalizeText(entities.office),
    )
  }

  if (entities.shopperId) {
    filtered = filtered.filter((visit) => visit.assignedShopperId === entities.shopperId)
  }

  filtered = applyDateFilter(filtered, dateFilter)

  const wantsCount = hasAnyKeyword(normalizedQuestion, COUNT_KEYWORDS)
  const wantsLatest = hasAnyKeyword(normalizedQuestion, LATEST_KEYWORDS)

  if (wantsLatest) {
    const limit = extractLimit(safeQuestion, 5, 20)
    const latest = sortNewest(filtered).slice(0, limit)

    if (latest.length === 0) {
      return {
        intent: 'latest_visits',
        answer: 'لا توجد زيارات مطابقة للفلتر المطلوب في آخر النتائج.',
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }

    return {
      intent: 'latest_visits',
      answer: `هذه أحدث ${latest.length} زيارة مطابقة لطلبك.`,
      matchedVisits: latest,
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  if (wantsCount || status || dateFilter || entities.city || entities.office || entities.shopperId) {
    const details = []
    if (status) details.push(`الحالة: ${status}`)
    if (entities.city) details.push(`المدينة: ${entities.city}`)
    if (entities.office) details.push(`المكتب: ${entities.office}`)
    if (entities.shopperName) details.push(`المتسوق: ${entities.shopperName}`)
    if (dateFilter?.type === 'date') details.push(`التاريخ: ${dateFilter.value}`)
    if (dateFilter?.type === 'week') details.push('الفترة: هذا الأسبوع')
    if (dateFilter?.type === 'month') details.push('الفترة: هذا الشهر')

    const summary = details.length > 0 ? ` (${details.join(' | ')})` : ''
    const sorted = sortNewest(filtered)

    if (wantsCount) {
      return {
        intent: 'count_filtered_visits',
        answer: `عدد الزيارات المطابقة${summary}: ${filtered.length}`,
        matchedVisits: sorted.slice(0, 10),
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }

    if (filtered.length === 0) {
      return {
        intent: 'filtered_visits',
        answer: `لا توجد زيارات مطابقة${summary}.`,
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }

    return {
      intent: 'filtered_visits',
      answer: `تم العثور على ${filtered.length} زيارة مطابقة${summary}.`,
      matchedVisits: sorted.slice(0, 10),
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  if (!isVisitDomainQuestion(normalizedQuestion)) {
    return {
      intent: 'out_of_scope',
      answer: 'أنا شات مخصص للداشبورد بس، تحب تسأل عن أي حاجة؟',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const latest = sortNewest(allVisits).slice(0, 5)

  return {
    intent: 'summary_fallback',
    answer: `${buildSummary(allVisits)}. لو محتاج تفاصيل أكثر، اذكر الحالة أو المدينة أو اسم المتسوق.`,
    matchedVisits: latest,
    suggestions: DEFAULT_SUGGESTIONS,
    needsLlm: true,
  }
}
