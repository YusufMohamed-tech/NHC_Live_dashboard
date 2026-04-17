const COUNT_KEYWORDS = ['كم', 'عدد', 'how many', 'count', 'total', 'كام']
const LATEST_KEYWORDS = ['latest', 'last', 'recent', 'اخر', 'آخر', 'حديثة', 'احدث', 'أحدث']
const TODAY_KEYWORDS = ['today', 'اليوم', 'النهارده', 'نهارده']
const YESTERDAY_KEYWORDS = ['yesterday', 'امس', 'أمس']
const THIS_WEEK_KEYWORDS = ['this week', 'الاسبوع', 'الأسبوع', 'الاسبوع ده', 'الأسبوع ده']
const THIS_MONTH_KEYWORDS = ['this month', 'هذا الشهر', 'الشهر ده']

const ANALYTICS_KEYWORDS = [
  'أكتر', 'اكتر', 'أكثر', 'اكثر', 'most', 'top', 'best',
  'أقل', 'اقل', 'least', 'lowest',
  'مين', 'who', 'أنهي', 'انهي', 'which',
  'نسبة', 'percentage', 'percent',
  'مقارنة', 'compare', 'مقارنه',
  'تحليل', 'analysis', 'analyze',
  'توزيع', 'distribution',
  'تقرير', 'report',
  'إحصاء', 'احصاء', 'stats', 'statistics',
]

const VISIT_DOMAIN_KEYWORDS = [
  'زيارة', 'زيارات', 'visit', 'visits', 'dashboard', 'داشبورد',
  'مدينة', 'city', 'فرع', 'office', 'متحري', 'متحريين',
  'متحري خفي', 'متحريين خفيين', 'shopper',
  'حالة', 'status', 'معلقة', 'قادمة', 'مكتملة', 'مسح',
  'count', 'total', 'عدد', 'كم', 'كام',
  'latest', 'last', 'recent', 'اخر', 'آخر',
  'today', 'yesterday', 'this week', 'this month',
  'اليوم', 'النهارده', 'نهارده', 'امس', 'أمس',
  'الاسبوع', 'الأسبوع', 'الشهر',
  ...ANALYTICS_KEYWORDS,
]

const STATUS_KEYWORDS = {
  معلقة: ['معلقة', 'معلقه', 'pending', 'new visit', 'new'],
  قادمة: ['قادمة', 'قادمه', 'upcoming', 'revisit', 'follow-up'],
  مكتملة: ['مكتملة', 'مكتمله', 'completed', 'done', 'finished'],
  'جاري المسح': ['جاري المسح', 'مسح', 'delete request', 'deleting'],
}

const DEFAULT_SUGGESTIONS = [
  'كام زيارة معلقة النهارده؟',
  'هات آخر 5 زيارات',
  'وريني الزيارات المكتملة الأسبوع ده',
  'مين المتحري الأكتر زيارات؟',
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

function todayDateKey() { return toDateKey(new Date()) }

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
  if (explicitDate) return { type: 'date', value: explicitDate[1] }
  if (hasAnyKeyword(normalizedQuestion, TODAY_KEYWORDS)) return { type: 'date', value: todayDateKey() }
  if (hasAnyKeyword(normalizedQuestion, YESTERDAY_KEYWORDS)) return { type: 'date', value: yesterdayDateKey() }
  if (hasAnyKeyword(normalizedQuestion, THIS_WEEK_KEYWORDS)) return { type: 'week', value: weekRange() }
  if (hasAnyKeyword(normalizedQuestion, THIS_MONTH_KEYWORDS)) return { type: 'month', value: monthRange() }
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
  const match = normalizedQuestion.match(/(?:اخر|آخر|last|latest|احدث|أحدث)\s+(\d{1,2})/)
  if (!match) return fallback
  const value = Number(match[1])
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(maxLimit, value))
}

function getVisitDateObject(visit) {
  const dateKey = String(visit?.date ?? '').trim()
  if (!dateKey) return new Date(0)
  const date = new Date(`${dateKey}T00:00:00`)
  return Number.isNaN(date.getTime()) ? new Date(0) : date
}

function sortNewest(visits) {
  return [...visits].sort((a, b) => getVisitDateObject(b) - getVisitDateObject(a))
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
  if (shopperName) pieces.push(`المتحري: ${shopperName}`)
  return pieces.join(' | ')
}

function applyDateFilter(visits, dateFilter) {
  if (!dateFilter) return visits
  if (dateFilter.type === 'date') {
    return visits.filter((v) => String(v.date ?? '').trim() === dateFilter.value)
  }
  if (dateFilter.type === 'week' || dateFilter.type === 'month') {
    const { start, end } = dateFilter.value
    return visits.filter((v) => {
      const date = getVisitDateObject(v)
      return date >= start && date <= end
    })
  }
  return visits
}

function detectEntityMatch(question, visits, shoppersById) {
  const normalizedQuestion = normalizeText(question)
  const citySet = Array.from(new Set(visits.map((v) => String(v.city ?? '').trim()).filter(Boolean)))
  const city = citySet.find((item) => normalizedQuestion.includes(normalizeText(item))) || null
  const officeSet = Array.from(new Set(visits.map((v) => String(v.officeName ?? '').trim()).filter(Boolean)))
  const office = officeSet.find(
    (item) => normalizeText(item).length >= 3 && normalizedQuestion.includes(normalizeText(item))
  ) || null
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
  const completed = visits.filter((v) => v.status === 'مكتملة').length
  const pending = visits.filter((v) => v.status === 'معلقة').length
  const upcoming = visits.filter((v) => v.status === 'قادمة').length
  const deleting = visits.filter((v) => v.status === 'جاري المسح').length
  return `الإجمالي: ${total} | معلقة: ${pending} | قادمة: ${upcoming} | مكتملة: ${completed} | جاري المسح: ${deleting}`
}

/**
 * NEW: Compute analytics that the LLM can use for complex questions
 */
function computeAnalytics(visits, shoppersById) {
  const cityCount = {}
  const shopperCount = {}
  const officeCount = {}
  const statusCount = {}
  const cityStatusCount = {}

  for (const visit of visits) {
    const city = visit.city ?? 'غير محدد'
    const office = visit.officeName ?? 'غير محدد'
    const status = visit.status ?? 'غير محدد'
    const shopperId = visit.assignedShopperId
    const shopperName = shoppersById.get(shopperId)?.name ?? `متحري ${shopperId ?? 'مجهول'}`

    cityCount[city] = (cityCount[city] ?? 0) + 1
    officeCount[office] = (officeCount[office] ?? 0) + 1
    statusCount[status] = (statusCount[status] ?? 0) + 1

    if (shopperId) {
      shopperCount[shopperName] = (shopperCount[shopperName] ?? 0) + 1
    }

    if (!cityStatusCount[city]) cityStatusCount[city] = {}
    cityStatusCount[city][status] = (cityStatusCount[city][status] ?? 0) + 1
  }

  const sortEntries = (obj) =>
    Object.entries(obj).sort(([, a], [, b]) => b - a)

  return {
    totalVisits: visits.length,
    byStatus: statusCount,
    topCities: sortEntries(cityCount).slice(0, 5),
    topOffices: sortEntries(officeCount).slice(0, 5),
    topShoppers: sortEntries(shopperCount).slice(0, 5),
    cityStatusBreakdown: cityStatusCount,
  }
}

/**
 * NEW: Detect if the question needs analytics/LLM reasoning
 */
function isAnalyticsQuestion(question) {
  return hasAnyKeyword(question, ANALYTICS_KEYWORDS)
}

/**
 * NEW: Build a rich context string for the LLM
 */
export function buildLlmContext({ question, visits, shoppersById, filteredVisits = null }) {
  const analytics = computeAnalytics(visits, shoppersById)
  const sample = sortNewest(filteredVisits ?? visits).slice(0, 15).map((v) => ({
    id: v.id,
    office: v.officeName,
    city: v.city,
    date: v.date,
    status: v.status,
    shopper: shoppersById.get(v.assignedShopperId)?.name ?? null,
    scenario: v.scenario,
  }))

  return `
أنت مساعد ذكي لنظام إدارة الزيارات. ردك بالعامية المصرية، خفيف وودي ومفيد.

=== إحصائيات الزيارات ===
${JSON.stringify(analytics, null, 2)}

=== عينة من أحدث الزيارات (${sample.length} زيارة) ===
${JSON.stringify(sample, null, 2)}

=== سؤال المستخدم ===
${question}

تعليمات:
- رد مباشر ومختصر بالعامية المصرية
- استخدم الأرقام والإحصائيات من البيانات اللي فوق
- لو السؤال عن "أكتر/أقل/مين"، احسب من البيانات وجاوب
- ممكن تعمل ملاحظة أو توصية لو في pattern واضح
- لا تكرر نفسك ولا تقول "يا هلا" في كل رد
- لو مش لاقي إجابة واضحة، قول بصراحة
`.trim()
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
      answer: 'يا هلا! 👋 اسألني عن أي حاجة في الزيارات—عدد، حالة، تاريخ، أو حتى "مين المتحري الأكتر شغل؟"',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const shoppersById = new Map((shoppers ?? []).map((s) => [s.id, s]))
  const allVisits = Array.isArray(visits) ? visits : []

  // --- Visit by UUID ---
  const visitId = extractVisitId(safeQuestion)
  if (visitId) {
    const found = allVisits.find((v) => String(v.id).toLowerCase() === visitId.toLowerCase())
    if (!found) {
      return {
        intent: 'visit_by_id',
        answer: `مش لاقي زيارة بالـ ID ده (${visitId}). ممكن تتأكد من الرقم؟`,
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }
    const shopperName = shoppersById.get(found.assignedShopperId)?.name ?? ''
    return {
      intent: 'visit_by_id',
      answer: `الزيارة المطلوبة:\n${formatVisitLine(found, shopperName)}`,
      matchedVisits: [found],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const status = detectStatus(safeQuestion)
  const dateFilter = detectDateFilter(safeQuestion)
  const entities = detectEntityMatch(safeQuestion, allVisits, shoppersById)

  let filtered = [...allVisits]
  if (status) filtered = filtered.filter((v) => v.status === status)
  if (entities.city) filtered = filtered.filter((v) => normalizeText(v.city) === normalizeText(entities.city))
  if (entities.office) filtered = filtered.filter((v) => normalizeText(v.officeName) === normalizeText(entities.office))
  if (entities.shopperId) filtered = filtered.filter((v) => v.assignedShopperId === entities.shopperId)
  filtered = applyDateFilter(filtered, dateFilter)

  const wantsCount = hasAnyKeyword(normalizedQuestion, COUNT_KEYWORDS)
  const wantsLatest = hasAnyKeyword(normalizedQuestion, LATEST_KEYWORDS)
  const wantsAnalytics = isAnalyticsQuestion(safeQuestion)

  // --- Analytics question → send to LLM with rich context ---
  if (wantsAnalytics) {
    const llmContext = buildLlmContext({
      question: safeQuestion,
      visits: allVisits,
      shoppersById,
      filteredVisits: filtered.length < allVisits.length ? filtered : null,
    })
    return {
      intent: 'analytics',
      answer: null,
      matchedVisits: sortNewest(filtered).slice(0, 10),
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: true,
      llmSystemPrompt: llmContext,
    }
  }

  // --- Latest N visits ---
  if (wantsLatest) {
    const limit = extractLimit(safeQuestion, 5, 20)
    const latest = sortNewest(filtered).slice(0, limit)
    if (latest.length === 0) {
      return {
        intent: 'latest_visits',
        answer: 'مفيش زيارات مطابقة. جرب تغير الفلتر.',
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }
    return {
      intent: 'latest_visits',
      answer: `آخر ${latest.length} زيارة:`,
      matchedVisits: latest,
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  // --- Count / filter questions ---
  if (wantsCount || status || dateFilter || entities.city || entities.office || entities.shopperId) {
    const details = []
    if (status) details.push(`الحالة: ${status}`)
    if (entities.city) details.push(`المدينة: ${entities.city}`)
    if (entities.office) details.push(`المكتب: ${entities.office}`)
    if (entities.shopperName) details.push(`المتحري: ${entities.shopperName}`)
    if (dateFilter?.type === 'date') details.push(`التاريخ: ${dateFilter.value}`)
    if (dateFilter?.type === 'week') details.push('الفترة: هذا الأسبوع')
    if (dateFilter?.type === 'month') details.push('الفترة: هذا الشهر')

    const summary = details.length > 0 ? ` (${details.join(' | ')})` : ''
    const sorted = sortNewest(filtered)

    if (wantsCount) {
      return {
        intent: 'count_filtered_visits',
        answer: `${filtered.length} زيارة${summary}`,
        matchedVisits: sorted.slice(0, 10),
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }

    if (filtered.length === 0) {
      return {
        intent: 'filtered_visits',
        answer: `مفيش زيارات${summary}.`,
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }

    return {
      intent: 'filtered_visits',
      answer: `${filtered.length} زيارة${summary}:`,
      matchedVisits: sorted.slice(0, 10),
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  // --- Out of scope ---
  if (!hasAnyKeyword(normalizedQuestion, VISIT_DOMAIN_KEYWORDS)) {
    return {
      intent: 'out_of_scope',
      answer: null,
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: true,
      llmSystemPrompt: `أنت مساعد ذكي ومرح. المستخدم سألك سؤال خارج نطاق نظام الزيارات. رد بالعامية المصرية بخفة وحاول تساعده أو توجهه. السؤال: "${safeQuestion}"`,
    }
  }

  // --- Summary fallback with LLM ---
  const analytics = computeAnalytics(allVisits, shoppersById)
  const llmContext = buildLlmContext({ question: safeQuestion, visits: allVisits, shoppersById })

  return {
    intent: 'summary_fallback',
    answer: buildSummary(allVisits),
    matchedVisits: sortNewest(allVisits).slice(0, 5),
    suggestions: DEFAULT_SUGGESTIONS,
    needsLlm: true,
    llmSystemPrompt: llmContext,
    analytics,
  }
}