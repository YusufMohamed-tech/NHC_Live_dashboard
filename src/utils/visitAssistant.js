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
  'متحري',
  'متحريين',
  'متحري خفي',
  'متحريين خفيين',
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
  'كام زيارة معلقة النهارده؟',
  'هات آخر 5 زيارات',
  'وريني الزيارات المكتملة الأسبوع ده',
  'فيه زيارات في الرياض؟',
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
    pieces.push(`المتحري الخفي: ${shopperName}`)
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
      answer: 'أهلاً بيك! أنا هنا أساعدك في أي سؤال عن زياراتك أو بيانات الداشبورد. جرب تسألني عن "عدد الزيارات اليوم" أو "زيارات مكتب الرياض" أو حتى "مين المتحري الخفي في زيارة معينة". ولو عندك سؤال غريب أو محتاج شرح أكتر، اسأل براحتك وأنا هحاول أوضح بأكتر من طريقة! 😊',
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
    let result;
    if (!found) {
      result = {
        intent: 'visit_by_id',
        answer: `ممكتش زيارة بالمعرف ${visitId}. لو تحب، ممكن أجيبلك آخر الزيارات أو تساعدني بمعلومة إضافية؟ جرب تسأل عن "آخر 5 زيارات" كمثال. 😊`,
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    } else {
      const shopperName = shoppersById.get(found.assignedShopperId)?.name ?? ''
      result = {
        intent: 'visit_by_id',
        answer: `لقيت الزيارة المطلوبة! 👀\n${formatVisitLine(found, shopperName)}\nلو محتاج تفاصيل أكتر أو عايز تعرف زيارات تانية قولي! مثال: "هات زيارات اليوم".`,
        matchedVisits: [found],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }
    // Always ensure suggestions are present
    if (!result.suggestions || result.suggestions.length === 0) {
      result.suggestions = DEFAULT_SUGGESTIONS
    }
    return result;
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
    let result;
    if (latest.length === 0) {
      result = {
        intent: 'latest_visits',
        answer: 'مفيش زيارات مطابقة للفلتر ده في آخر النتائج. جرب تغير الفلتر أو تسألني عن "كل الزيارات المكتملة" مثلاً! 😊',
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    } else {
      result = {
        intent: 'latest_visits',
        answer: `دي أحدث ${latest.length} زيارة لطلبك! مثال: لو عايز تفاصيل أكتر عن زيارة معينة، قولي رقمها أو اسألني عن "زيارات اليوم". 😉`,
        matchedVisits: latest,
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }
    if (!result.suggestions || result.suggestions.length === 0) {
      result.suggestions = DEFAULT_SUGGESTIONS
    }
    return result;
  }

  if (wantsCount || status || dateFilter || entities.city || entities.office || entities.shopperId) {
    const details = []
    if (status) details.push(`الحالة: ${status}`)
    if (entities.city) details.push(`المدينة: ${entities.city}`)
    if (entities.office) details.push(`المكتب: ${entities.office}`)
    if (entities.shopperName) details.push(`المتحري الخفي: ${entities.shopperName}`)
    if (dateFilter?.type === 'date') details.push(`التاريخ: ${dateFilter.value}`)
    if (dateFilter?.type === 'week') details.push('الفترة: هذا الأسبوع')
    if (dateFilter?.type === 'month') details.push('الفترة: هذا الشهر')

    const summary = details.length > 0 ? ` (${details.join(' | ')})` : ''
    const sorted = sortNewest(filtered)
    let result;
    if (wantsCount) {
      result = {
        intent: 'count_filtered_visits',
        answer: `عندك ${filtered.length} زيارة مطابقة${summary}! لو محتاج تفاصيل عن أي واحدة منهم، قولي رقمها أو اسألني عن "آخر زيارات". مثال: "هات آخر 3 زيارات مكتملة". 😉`,
        matchedVisits: sorted.slice(0, 10),
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    } else if (filtered.length === 0) {
      result = {
        intent: 'filtered_visits',
        answer: `مفيش زيارات مطابقة${summary}. جرب تغير الفلتر أو تسألني عن "زيارات اليوم" أو "كل الزيارات المكتملة". لو محتاج مساعدة في صياغة السؤال، قولي! 😊`,
        matchedVisits: [],
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    } else {
      result = {
        intent: 'filtered_visits',
        answer: `لقيت ${filtered.length} زيارة مطابقة${summary}! لو عايز تفاصيل أكتر أو مثال على زيارة معينة، قولي اسم المكتب أو المدينة أو رقم الزيارة. مثال: "هات زيارات مكتب جدة". 😉`,
        matchedVisits: sorted.slice(0, 10),
        suggestions: DEFAULT_SUGGESTIONS,
        needsLlm: false,
      }
    }
    if (!result.suggestions || result.suggestions.length === 0) {
      result.suggestions = DEFAULT_SUGGESTIONS
    }
    return result;
  }

  // Handle requests for more explanation or clarification flexibly
  const clarificationKeywords = [
    'شرح', 'فسر', 'وضح', 'explain', 'clarify', 'more details', 'details', 'expand', 'expand more', 'محتاج شرح', 'عايز شرح', 'عايز افهم', 'عايز تفاصيل', 'محتاج تفاصيل', 'ممكن توضح', 'ممكن تفاصيل', 'ممكن مثال', 'عايز مثال', 'محتاج مثال'
  ];
  if (clarificationKeywords.some((kw) => normalizedQuestion.includes(normalizeText(kw)))) {
    return {
      intent: 'clarification',
      answer: 'أكيد! لو محتاج شرح أكتر لأي نقطة، ممكن تسألني عن مثال عملي أو توضحلي الجزء اللي مش واضح. مثلاً: "كام زيارة مكتملة النهارده؟" معناها أجيبلك عدد الزيارات اللي حالتها مكتملة اليوم، ولو عايز تفاصيل أكتر عن زيارة معينة، قولي رقمها أو اسم المكتب. لو عندك سيناريو معين في بالك، اكتبه وأنا أساعدك خطوة بخطوة! 😉',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  if (!isVisitDomainQuestion(normalizedQuestion)) {
    return {
      intent: 'out_of_scope',
      answer: 'أنا هنا أجاوبك عن كل ما يخص زياراتك وبيانات الداشبورد. لو سؤالك خارج النطاق، جرب تعيد صياغته أو تسألني عن "عدد الزيارات اليوم" أو "زيارات مكتب معين" أو حتى "تفاصيل متحري خفي". ولو عندك فكرة أو سؤال مش واضح، اكتبه بأي طريقة تعجبك وأنا هحاول أفهمك وأساعدك! 😊',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const latest = sortNewest(allVisits).slice(0, 5)
  return {
    intent: 'summary_fallback',
    answer: `دي لمحة سريعة عن زياراتك: ${buildSummary(allVisits)}. لو عندك سؤال محدد أو محتاج توضيح أكتر، جرب تسألني عن "زيارات اليوم" أو "زيارات مكتب معين" أو حتى "تفاصيل متحري خفي". أنا هنا أساعدك بأي طريقة تناسبك، ولو عندك فكرة أو سيناريو معين اكتبه وأنا أشرحلك خطوة بخطوة! 😉`,
    matchedVisits: latest,
    suggestions: DEFAULT_SUGGESTIONS,
    needsLlm: true,
  }
}
