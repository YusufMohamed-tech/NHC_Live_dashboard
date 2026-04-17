// ============================================================
// RESPONSE VARIATION ENGINE
// ============================================================

const GREETINGS = [
  'تمام!', 'يلا!', 'حاضر،', 'أيوه،', 'معاك،', 'ماشي،', 'هو ده،', 'طيب،'
]

const EMPTY_QUESTION_RESPONSES = [
  'مرحباً! اسألني عن أي حاجة في الزيارات 👋',
  'أهلاً! جاهز أساعدك في أي سؤال عن الزيارات.',
  'يا هلا! إيه اللي تحب تعرفه؟',
]

const NO_RESULTS_VARIANTS = [
  (summary) => `مفيش ${summary} في النتائج دي.`,
  (summary) => `ملقتش ${summary}—جرب فلتر تاني.`,
  (summary) => `الـ ${summary} دي مش موجودة حالياً.`,
]

const COUNT_PREFIXES = [
  (n, label) => `عندك ${n} ${label}.`,
  (n, label) => `في ${n} ${label} مطابقة.`,
  (n, label) => `الناتج: ${n} ${label}.`,
  (n, label) => `${n} ${label} 👌`,
]

const LATEST_PREFIXES = [
  (n) => `أحدث ${n} زيارة:`,
  (n) => `دول آخر ${n}:`,
  (n) => `هات${n === 1 ? 'ها' : 'هم'} دول:`,
]

const FILTER_PREFIXES = [
  (n, detail) => `لقيت ${n} زيارة${detail}:`,
  (n, detail) => `في ${n} زيارة${detail}:`,
  (n, detail) => `النتيجة ${n} زيارة${detail}:`,
]

const FOLLOW_UP_SUGGESTIONS = {
  معلقة: ['كام زيارة معلقة النهارده؟', 'هات آخر 3 معلقة', 'الزيارات المعلقة الأسبوع ده'],
  قادمة: ['كام زيارة قادمة الشهر ده؟', 'هات آخر 5 قادمة', 'الزيارات القادمة في الرياض'],
  مكتملة: ['كام مكتملة النهارده؟', 'هات آخر 10 مكتملة', 'الزيارات المكتملة الأسبوع ده'],
  city: (city) => [`كام زيارة في ${city}؟`, `الزيارات المعلقة في ${city}`, `آخر 5 زيارات في ${city}`],
  analytics: ['مين المتحري الأكتر زيارات؟', 'أنهي مدينة أكتر زيارات معلقة؟', 'وريني ملخص الشهر ده'],
  default: ['كام زيارة معلقة النهارده؟', 'هات آخر 5 زيارات', 'وريني الزيارات المكتملة الأسبوع ده', 'مين المتحري الأكتر زيارات؟'],
}

// ============================================================
// CONVERSATION MEMORY
// ============================================================

/** 
 * conversationHistory: array of { role: 'user'|'assistant', intent, entities, timestamp }
 * Used to: avoid repeating same answer, give contextual follow-ups, remember last filter
 */
export class ConversationMemory {
  constructor() {
    this.history = []
    this.lastFilter = null
    this.mentionedEntities = new Set()
  }

  push(entry) {
    this.history.push({ ...entry, timestamp: Date.now() })
    if (this.history.length > 20) this.history.shift()
    if (entry.entities?.city) this.mentionedEntities.add(entry.entities.city)
    if (entry.entities?.status) this.mentionedEntities.add(entry.entities.status)
    if (entry.filter) this.lastFilter = entry.filter
  }

  getLastIntent() {
    return this.history.filter(h => h.role === 'assistant').slice(-1)[0]?.intent ?? null
  }

  getLastUserMessage() {
    return this.history.filter(h => h.role === 'user').slice(-1)[0]?.text ?? ''
  }

  isRepeatQuestion(question) {
    const recent = this.history.filter(h => h.role === 'user').slice(-3)
    return recent.some(h => normalizeText(h.text) === normalizeText(question))
  }

  getContext() {
    return {
      lastIntent: this.getLastIntent(),
      lastFilter: this.lastFilter,
      mentionedEntities: Array.from(this.mentionedEntities),
      turnCount: this.history.length,
    }
  }
}

// ============================================================
// UTILS
// ============================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickFn(arr, ...args) {
  return pick(arr)(...args)
}

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
  'نسبة', 'percentage', 'تحليل', 'analysis',
  'مقارنة', 'compare', 'توزيع', 'distribution',
  'تقرير', 'report', 'إحصاء', 'احصاء', 'stats',
]
const VISIT_DOMAIN_KEYWORDS = [
  'زيارة', 'زيارات', 'visit', 'visits', 'dashboard', 'داشبورد',
  'مدينة', 'city', 'فرع', 'office', 'متحري', 'متحريين',
  'متحري خفي', 'shopper', 'حالة', 'status',
  'معلقة', 'قادمة', 'مكتملة', 'مسح',
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

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '')
}

function hasAnyKeyword(q, kws) {
  return kws.some(k => normalizeText(q).includes(normalizeText(k)))
}

function toDateKey(d) {
  const date = new Date(d)
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function todayKey() { return toDateKey(new Date()) }
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate()-1); return toDateKey(d) }

function weekRange() {
  const now = new Date(), day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(now); start.setDate(now.getDate()+diff); start.setHours(0,0,0,0)
  const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999)
  return { start, end }
}

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0); end.setHours(23,59,59,999)
  return { start, end }
}

function detectStatus(q) {
  const n = normalizeText(q)
  for (const [status, kws] of Object.entries(STATUS_KEYWORDS)) {
    if (kws.some(k => n.includes(normalizeText(k)))) return status
  }
  return null
}

function detectDateFilter(q) {
  const n = normalizeText(q)
  const explicit = n.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (explicit) return { type: 'date', value: explicit[1] }
  if (hasAnyKeyword(n, TODAY_KEYWORDS)) return { type: 'date', value: todayKey() }
  if (hasAnyKeyword(n, YESTERDAY_KEYWORDS)) return { type: 'date', value: yesterdayKey() }
  if (hasAnyKeyword(n, THIS_WEEK_KEYWORDS)) return { type: 'week', value: weekRange() }
  if (hasAnyKeyword(n, THIS_MONTH_KEYWORDS)) return { type: 'month', value: monthRange() }
  return null
}

function extractVisitId(q) {
  const m = String(q).match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)
  return m ? m[0] : null
}

function extractLimit(q, fallback = 5, max = 20) {
  const m = normalizeText(q).match(/(?:اخر|آخر|last|latest|احدث|أحدث)\s+(\d{1,2})/)
  if (!m) return fallback
  return Math.max(1, Math.min(max, Number(m[1]) || fallback))
}

function getVisitDate(v) {
  const d = new Date(`${String(v?.date??'').trim()}T00:00:00`)
  return isNaN(d.getTime()) ? new Date(0) : d
}

function sortNewest(visits) {
  return [...visits].sort((a,b) => getVisitDate(b) - getVisitDate(a))
}

function applyDateFilter(visits, df) {
  if (!df) return visits
  if (df.type === 'date') return visits.filter(v => String(v.date??'').trim() === df.value)
  const { start, end } = df.value
  return visits.filter(v => { const d = getVisitDate(v); return d >= start && d <= end })
}

function detectEntityMatch(q, visits, shoppersById) {
  const n = normalizeText(q)
  const cities = [...new Set(visits.map(v => String(v.city??'').trim()).filter(Boolean))]
  const city = cities.find(c => n.includes(normalizeText(c))) || null
  const offices = [...new Set(visits.map(v => String(v.officeName??'').trim()).filter(Boolean))]
  const office = offices.find(o => normalizeText(o).length >= 3 && n.includes(normalizeText(o))) || null
  const shopperEntries = [...shoppersById.entries()]
  const shopperEntry = shopperEntries.find(([,s]) => {
    const name = normalizeText(s?.name)
    return name && name.length >= 2 && n.includes(name)
  })
  return {
    city,
    office,
    shopperId: shopperEntry?.[0] ?? null,
    shopperName: shopperEntry?.[1]?.name ?? '',
  }
}

function computeAnalytics(visits, shoppersById) {
  const cityCount = {}, shopperCount = {}, officeCount = {}, statusCount = {}, cityStatus = {}
  for (const v of visits) {
    const city = v.city ?? 'غير محدد'
    const office = v.officeName ?? 'غير محدد'
    const status = v.status ?? 'غير محدد'
    const shopperName = shoppersById.get(v.assignedShopperId)?.name ?? null
    cityCount[city] = (cityCount[city]??0) + 1
    officeCount[office] = (officeCount[office]??0) + 1
    statusCount[status] = (statusCount[status]??0) + 1
    if (shopperName) shopperCount[shopperName] = (shopperCount[shopperName]??0) + 1
    if (!cityStatus[city]) cityStatus[city] = {}
    cityStatus[city][status] = (cityStatus[city][status]??0) + 1
  }
  const sort = obj => Object.entries(obj).sort(([,a],[,b]) => b-a)
  return {
    totalVisits: visits.length,
    byStatus: statusCount,
    topCities: sort(cityCount).slice(0,5),
    topOffices: sort(officeCount).slice(0,5),
    topShoppers: sort(shopperCount).slice(0,5),
    cityStatusBreakdown: cityStatus,
  }
}

function buildSummary(visits) {
  const total = visits.length
  const s = (status) => visits.filter(v => v.status === status).length
  return `الإجمالي: ${total} | معلقة: ${s('معلقة')} | قادمة: ${s('قادمة')} | مكتملة: ${s('مكتملة')} | جاري المسح: ${s('جاري المسح')}`
}

/** Smart context-aware suggestions */
function buildSuggestions(intent, entities, conversationCtx) {
  if (entities?.city && FOLLOW_UP_SUGGESTIONS.city) {
    return FOLLOW_UP_SUGGESTIONS.city(entities.city)
  }
  if (entities?.status && FOLLOW_UP_SUGGESTIONS[entities.status]) {
    return FOLLOW_UP_SUGGESTIONS[entities.status]
  }
  if (intent === 'analytics') return FOLLOW_UP_SUGGESTIONS.analytics
  return FOLLOW_UP_SUGGESTIONS.default
}

/** Add contextual note based on data patterns */
function buildContextualNote(filtered, allVisits, intent) {
  if (filtered.length === 0 || intent === 'analytics') return null
  
  const pendingRatio = filtered.filter(v => v.status === 'معلقة').length / filtered.length
  if (pendingRatio > 0.6 && filtered.length > 3) {
    return `💡 لاحظت إن ${Math.round(pendingRatio*100)}% من النتائج دي معلقة.`
  }
  
  const today = todayKey()
  const todayCount = filtered.filter(v => String(v.date??'').trim() === today).length
  if (todayCount > 0 && intent !== 'count_filtered_visits') {
    return `📅 منهم ${todayCount} زيارة النهارده.`
  }
  
  return null
}

// ============================================================
// MAIN EXPORT
// ============================================================

export function runVisitAssistant({ question, visits = [], shoppers = [], memory = null }) {
  const safeQuestion = String(question ?? '').trim()
  const normalizedQuestion = normalizeText(safeQuestion)
  const ctx = memory?.getContext() ?? {}

  if (!safeQuestion) {
    return {
      intent: 'empty',
      answer: pick(EMPTY_QUESTION_RESPONSES),
      matchedVisits: [],
      suggestions: FOLLOW_UP_SUGGESTIONS.default,
      needsLlm: false,
    }
  }

  // Detect repeat question
  const isRepeat = memory?.isRepeatQuestion(safeQuestion)

  const shoppersById = new Map((shoppers ?? []).map(s => [s.id, s]))
  const allVisits = Array.isArray(visits) ? visits : []

  // --- Visit by UUID ---
  const visitId = extractVisitId(safeQuestion)
  if (visitId) {
    const found = allVisits.find(v => String(v.id).toLowerCase() === visitId.toLowerCase())
    if (!found) {
      return {
        intent: 'visit_by_id',
        answer: `مش لاقي زيارة بالـ ID ده (${visitId}). ممكن تتأكد من الرقم؟`,
        matchedVisits: [],
        suggestions: FOLLOW_UP_SUGGESTIONS.default,
        needsLlm: false,
      }
    }
    const shopperName = shoppersById.get(found.assignedShopperId)?.name ?? ''
    const pieces = [found.officeName, found.city, found.date, found.time, found.status, shopperName ? `متحري: ${shopperName}` : null].filter(Boolean)
    return {
      intent: 'visit_by_id',
      answer: `الزيارة #${found.id}:\n${pieces.join(' | ')}`,
      matchedVisits: [found],
      suggestions: buildSuggestions('visit_by_id', {}, ctx),
      needsLlm: false,
    }
  }

  const status = detectStatus(safeQuestion)
  const dateFilter = detectDateFilter(safeQuestion)
  const entities = detectEntityMatch(safeQuestion, allVisits, shoppersById)

  let filtered = [...allVisits]
  if (status) filtered = filtered.filter(v => v.status === status)
  if (entities.city) filtered = filtered.filter(v => normalizeText(v.city) === normalizeText(entities.city))
  if (entities.office) filtered = filtered.filter(v => normalizeText(v.officeName) === normalizeText(entities.office))
  if (entities.shopperId) filtered = filtered.filter(v => v.assignedShopperId === entities.shopperId)
  filtered = applyDateFilter(filtered, dateFilter)

  const wantsCount = hasAnyKeyword(normalizedQuestion, COUNT_KEYWORDS)
  const wantsLatest = hasAnyKeyword(normalizedQuestion, LATEST_KEYWORDS)
  const wantsAnalytics = hasAnyKeyword(safeQuestion, ANALYTICS_KEYWORDS)

  // Build detail string for filter answers
  const details = []
  if (status) details.push(status)
  if (entities.city) details.push(entities.city)
  if (entities.office) details.push(entities.office)
  if (entities.shopperName) details.push(`متحري: ${entities.shopperName}`)
  if (dateFilter?.type === 'date') details.push(dateFilter.value)
  if (dateFilter?.type === 'week') details.push('الأسبوع ده')
  if (dateFilter?.type === 'month') details.push('الشهر ده')
  const detailStr = details.length > 0 ? ` (${details.join(' | ')})` : ''

  // --- Analytics ---
  if (wantsAnalytics) {
    const analytics = computeAnalytics(filtered.length < allVisits.length ? filtered : allVisits, shoppersById)
    
    // Answer analytically from data without LLM
    let analyticsAnswer = ''
    const n = normalizeText(safeQuestion)
    
    if ((n.includes('مين') || n.includes('who')) && (n.includes('متحري') || n.includes('shopper'))) {
      const top = analytics.topShoppers[0]
      if (top) analyticsAnswer = `${pick(GREETINGS)} المتحري الأكتر زيارات هو "${top[0]}" بـ ${top[1]} زيارة.`
      else analyticsAnswer = 'مفيش بيانات متحريين كافية.'
    } else if (n.includes('مدينة') || n.includes('city')) {
      const top = analytics.topCities[0]
      if (top) {
        const breakdown = analytics.cityStatusBreakdown[top[0]]
        const pending = breakdown?.['معلقة'] ?? 0
        analyticsAnswer = `${pick(GREETINGS)} أكتر مدينة هي "${top[0]}" بـ ${top[1]} زيارة${pending > 0 ? `، منهم ${pending} معلقة` : ''}.`
      } else analyticsAnswer = 'مفيش بيانات مدن كافية.'
    } else if (n.includes('مكتب') || n.includes('office') || n.includes('فرع')) {
      const top = analytics.topOffices[0]
      if (top) analyticsAnswer = `${pick(GREETINGS)} أكتر فرع هو "${top[0]}" بـ ${top[1]} زيارة.`
      else analyticsAnswer = 'مفيش بيانات فروع كافية.'
    } else if (n.includes('نسبة') || n.includes('percent')) {
      const total = analytics.totalVisits
      if (total > 0) {
        const parts = Object.entries(analytics.byStatus)
          .map(([s, c]) => `${s}: ${Math.round(c/total*100)}%`)
          .join(' | ')
        analyticsAnswer = `توزيع الحالات: ${parts}`
      }
    } else {
      // General analytics summary
      const topCity = analytics.topCities[0]
      const topShopper = analytics.topShoppers[0]
      const parts = []
      if (topCity) parts.push(`أكتر مدينة: ${topCity[0]} (${topCity[1]})`)
      if (topShopper) parts.push(`أكتر متحري: ${topShopper[0]} (${topShopper[1]})`)
      analyticsAnswer = parts.length > 0 ? `${pick(GREETINGS)} ${parts.join(' | ')}` : buildSummary(allVisits)
    }

    return {
      intent: 'analytics',
      answer: analyticsAnswer,
      matchedVisits: sortNewest(filtered).slice(0, 5),
      suggestions: FOLLOW_UP_SUGGESTIONS.analytics,
      needsLlm: false,
      analytics,
    }
  }

  // --- Latest ---
  if (wantsLatest) {
    const limit = extractLimit(safeQuestion, 5, 20)
    const latest = sortNewest(filtered).slice(0, limit)
    if (latest.length === 0) {
      return {
        intent: 'latest_visits',
        answer: pickFn(NO_RESULTS_VARIANTS, `${limit} زيارة`),
        matchedVisits: [],
        suggestions: buildSuggestions('latest_visits', entities, ctx),
        needsLlm: false,
      }
    }
    const note = buildContextualNote(latest, allVisits, 'latest_visits')
    return {
      intent: 'latest_visits',
      answer: pickFn(LATEST_PREFIXES, latest.length) + (note ? `\n${note}` : ''),
      matchedVisits: latest,
      suggestions: buildSuggestions('latest_visits', entities, ctx),
      needsLlm: false,
    }
  }

  // --- Count / filter ---
  if (wantsCount || status || dateFilter || entities.city || entities.office || entities.shopperId) {
    const sorted = sortNewest(filtered)
    
    if (wantsCount) {
      const note = buildContextualNote(filtered, allVisits, 'count_filtered_visits')
      return {
        intent: 'count_filtered_visits',
        answer: pickFn(COUNT_PREFIXES, filtered.length, `زيارة${detailStr}`) + (note ? `\n${note}` : ''),
        matchedVisits: sorted.slice(0, 10),
        suggestions: buildSuggestions('count_filtered_visits', { ...entities, status }, ctx),
        needsLlm: false,
      }
    }

    if (filtered.length === 0) {
      return {
        intent: 'filtered_visits',
        answer: pickFn(NO_RESULTS_VARIANTS, `زيارات${detailStr}`),
        matchedVisits: [],
        suggestions: buildSuggestions('filtered_visits', { ...entities, status }, ctx),
        needsLlm: false,
      }
    }

    const note = buildContextualNote(filtered, allVisits, 'filtered_visits')
    return {
      intent: 'filtered_visits',
      answer: pickFn(FILTER_PREFIXES, filtered.length, detailStr) + (note ? `\n${note}` : ''),
      matchedVisits: sorted.slice(0, 10),
      suggestions: buildSuggestions('filtered_visits', { ...entities, status }, ctx),
      needsLlm: false,
    }
  }

  // --- Out of scope ---
  if (!hasAnyKeyword(normalizedQuestion, VISIT_DOMAIN_KEYWORDS)) {
    return {
      intent: 'out_of_scope',
      answer: pick([
        'ده خارج نطاق الزيارات، بس جرب تسألني عن الداشبورد!',
        'مش متخصص في ده، لو عندك سؤال عن الزيارات أنا موجود.',
        'سؤال جامد! بس أنا بتعامل مع الزيارات بس 😄',
      ]),
      matchedVisits: [],
      suggestions: FOLLOW_UP_SUGGESTIONS.default,
      needsLlm: false,
    }
  }

  // --- Summary fallback ---
  return {
    intent: 'summary_fallback',
    answer: buildSummary(allVisits),
    matchedVisits: sortNewest(allVisits).slice(0, 5),
    suggestions: FOLLOW_UP_SUGGESTIONS.default,
    needsLlm: false,
  }
}