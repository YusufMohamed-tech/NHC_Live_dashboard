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

// Flexible keywords for 'top shopper' questions (multiple phrasings supported)
const TOP_SHOPPER_KEYWORDS = [
  'اعلى متحري', 'أعلى متحري', 'اكثر متحري', 'أكثر متحري', 'top shopper', 'most visits', 'most active', 'top performer',
  'مين عمل زيارات اكتر', 'مين عمل زيارات أكثر', 'مين نفذ زيارات اكتر', 'مين نفذ زيارات أكثر',
  'مين جاب اعلى تقييم', 'مين جاب أعلى تقييم', 'مين تقييمه اعلى', 'مين تقييمه أعلى', 'افضل متحري', 'أفضل متحري',
  'مين عنده زيارات كتير', 'مين عنده زيارات أكثر', 'مين عنده تقييم عالي', 'مين عنده تقييم أعلى',
  'مين متفوق', 'مين متفوق في الزيارات', 'مين متفوق في التقييمات',
  'top rated', 'highest rating', 'best rating', 'most rated', 'top points', 'اعلى نقاط', 'أعلى نقاط',
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
      answer: 'يا هلا! 👋 أنا هنا زي صديقك الذكي اللي دايمًا جاهز يساعدك في أي سؤال عن زياراتك أو الداشبورد. اسألني عن أي حاجة—even لو السؤال غريب أو خارج الموضوع—وأنا هحاول أساعدك أو أضحكك! جرب مثلاً: "كام زيارة مكتملة النهارده؟" أو "هات آخر 5 زيارات". ولو محتاج نصيحة أو فكرة جديدة، أنا موجود! 🚀',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const shoppersById = new Map((shoppers ?? []).map((shopper) => [shopper.id, shopper]))
  const allVisits = Array.isArray(visits) ? visits : []

  // If the user asks about top/most active or top-rated shoppers, return a concise main-points summary
  if (hasAnyKeyword(normalizedQuestion, TOP_SHOPPER_KEYWORDS)) {
    const visitsByShopper = new Map()
    for (const v of allVisits) {
      if (!v.assignedShopperId) continue
      visitsByShopper.set(v.assignedShopperId, (visitsByShopper.get(v.assignedShopperId) || 0) + 1)
    }

    let topShopperId = null
    let topVisits = 0
    for (const [id, cnt] of visitsByShopper.entries()) {
      if (cnt > topVisits) {
        topVisits = cnt
        topShopperId = id
      }
    }

    // detect numeric evaluation/rating fields (flexible field names)
    const ratingFields = ['rating', 'score', 'evaluation', 'points', 'pointsEarned']
    const ratingsByShopper = new Map()
    for (const v of allVisits) {
      if (!v.assignedShopperId) continue
      let num = null
      for (const f of ratingFields) {
        if (v[f] !== undefined && v[f] !== null && !Number.isNaN(Number(v[f]))) {
          num = Number(v[f])
          break
        }
      }
      if (num !== null) {
        const arr = ratingsByShopper.get(v.assignedShopperId) || []
        arr.push(num)
        ratingsByShopper.set(v.assignedShopperId, arr)
      }
    }

    let topRatedShopperId = null
    let topAvg = 0
    for (const [id, arr] of ratingsByShopper.entries()) {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length
      if (avg > topAvg) {
        topAvg = avg
        topRatedShopperId = id
      }
    }

    const parts = []
    const shoppersMap = shoppersById

    if (topShopperId && shoppersMap.get(topShopperId)) {
      const s = shoppersMap.get(topShopperId)
      const cities = [...new Set(allVisits.filter((v) => v.assignedShopperId === topShopperId).map((v) => v.city).filter(Boolean))].slice(0, 2)
      parts.push(`أكثر متحري خفي نشاطًا هو "${s.name}" بعدد ${topVisits} زيارة. هذا يعني أنه نفذ أكبر عدد زيارات في الفترة الحالية.`)
      parts.push(`مثال سريع: ${s.name} نفذ ${topVisits} زيارة في مدن مثل: ${cities.length ? cities.join(', ') : 'مدن مختلفة'}.`)
    }

    if (topRatedShopperId && shoppersMap.get(topRatedShopperId)) {
      const s = shoppersMap.get(topRatedShopperId)
      const offices = [...new Set(allVisits.filter((v) => v.assignedShopperId === topRatedShopperId && v.officeName).map((v) => v.officeName))].slice(0, 2)
      parts.push(`أما أعلى تقييم فكان لدى "${s.name}" بمتوسط تقييم ${topAvg.toFixed(2)}.`)
      if (offices.length) parts.push(`مثال: حصل على تقييمات مرتفعة في مكاتب مثل: ${offices.join(', ')}.`)
    }

    let answer = parts.length ? parts.join('\n\n') : 'لا توجد بيانات كافية عن المتحريين أو التقييمات حالياً.'
    if (parts.length) answer += '\n\nتحب أشوف بعض الزيارات كنماذج أو أعمل مقارنة بين متحريين؟'

    // sample matched visits (limit to 3) to give quick context without dumping كل التقارير
    let sample = []
    if (topShopperId) sample = sortNewest(allVisits).filter((v) => v.assignedShopperId === topShopperId).slice(0, 3)
    else if (topRatedShopperId) sample = sortNewest(allVisits).filter((v) => v.assignedShopperId === topRatedShopperId).slice(0, 3)

    return {
      intent: 'top_shopper_summary',
      answer,
      matchedVisits: sample,
      suggestions: [
        'هات تفاصيل زيارات المتحري الأعلى',
        'قارن بين متحريين في الأداء',
        'مين أكتر متحري نشط الشهر ده؟',
      ],
      needsLlm: false,
    }
  }

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
      answer: 'ولا يهمك! 😄 أنا هنا عشان أوضح لك أي نقطة مهما كانت. تحب أديك مثال عملي أو أشرح خطوة بخطوة؟ لو عندك سؤال محيرك أو حتى لو عايز نصيحة ذكية، اسألني! دايمًا عندي طريقة أبسط أو فكرة جانبية ممكن تساعدك. جربني! 💡',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  if (!isVisitDomainQuestion(normalizedQuestion)) {
    return {
      intent: 'out_of_scope',
      answer: 'سؤالك جامد! 😅 حتى لو خارج نطاق الزيارات أو الداشبورد، أنا هنا أحاول أساعدك أو أضحكك أو أديك فكرة جانبية. جرب تسألني عن "عدد الزيارات اليوم" أو "زيارات مكتب معين" أو حتى "تفاصيل متحري خفي". ولو عندك سؤال غريب أو محتاج نصيحة في الحياة، جربني! 😉',
      matchedVisits: [],
      suggestions: DEFAULT_SUGGESTIONS,
      needsLlm: false,
    }
  }

  const latest = sortNewest(allVisits).slice(0, 5)
  return {
    intent: 'summary_fallback',
    answer: `ها هي لمحة سريعة عن زياراتك: ${buildSummary(allVisits)}. لو عندك سؤال محدد أو حتى فكرة مجنونة، جرب تسألني! أنا هنا زي صديقك الذكي: أشرح، أديك أمثلة، أو حتى أشاركك نصيحة جانبية لو حابب. مستني سؤالك الجاي! 🤗`,
    matchedVisits: latest,
    suggestions: DEFAULT_SUGGESTIONS,
    needsLlm: true,
  }
}
