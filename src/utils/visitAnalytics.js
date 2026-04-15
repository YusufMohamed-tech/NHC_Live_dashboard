import { calculateWeightedScore } from './scoring'

const CHART_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#64748b']

function roundTo(value, digits = 2) {
  const safeValue = Number(value ?? 0)
  const factor = 10 ** digits
  return Math.round(safeValue * factor) / factor
}

function normalizeText(value, fallback = '-') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function parseVisitDate(value) {
  const source = String(value ?? '').trim()
  if (!source) return null

  const direct = new Date(source)
  if (!Number.isNaN(direct.getTime())) return direct

  const dateOnly = source.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const fallback = new Date(`${dateOnly}T00:00:00`)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  return null
}

function getMonthKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getMonthLabel(monthKey) {
  const [yearValue, monthValue] = monthKey.split('-').map(Number)
  if (!yearValue || !monthValue) return monthKey

  return new Intl.DateTimeFormat('ar-SA', { month: 'short' }).format(
    new Date(yearValue, monthValue - 1, 1),
  )
}

function getAnchorDate(visits) {
  const timestamps = visits
    .map((visit) => parseVisitDate(visit.date))
    .filter(Boolean)
    .map((date) => date.getTime())

  if (timestamps.length === 0) {
    return new Date()
  }

  return new Date(Math.max(...timestamps))
}

function buildMonthKeys({ visits, months = 6 }) {
  const anchorDate = getAnchorDate(visits)
  const monthKeys = []

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1)
    monthKeys.push(getMonthKey(date))
  }

  return monthKeys
}

function normalizeIssue(issue, visitsById, index) {
  const visitId = issue.visitId ?? issue.visit_id
  const sourceVisit = visitsById.get(visitId)

  return {
    id: issue.id ?? `${visitId ?? 'issue'}-${index}`,
    visitId: visitId ?? sourceVisit?.id ?? null,
    severity: normalizeText(issue.severity, 'بسيطة'),
    description: normalizeText(issue.description, 'بدون وصف'),
    officeName: normalizeText(issue.officeName ?? sourceVisit?.officeName),
    city: normalizeText(issue.city ?? sourceVisit?.city),
    date: normalizeText(issue.date ?? sourceVisit?.date),
  }
}

function buildIssuesSource({ visits, issues }) {
  const visitsById = new Map(visits.map((visit) => [visit.id, visit]))

  if (issues.length > 0) {
    return issues.map((issue, index) => normalizeIssue(issue, visitsById, index))
  }

  return visits.flatMap((visit) => {
    const visitIssues = Array.isArray(visit.issues) ? visit.issues : []

    return visitIssues.map((issue, issueIndex) =>
      normalizeIssue(
        {
          ...issue,
          visitId: issue.visitId ?? issue.visit_id ?? visit.id,
          officeName: issue.officeName ?? visit.officeName,
          city: issue.city ?? visit.city,
          date: issue.date ?? visit.date,
        },
        visitsById,
        issueIndex,
      ),
    )
  })
}

function countIssuesByVisit(issueRecords) {
  const map = new Map()

  issueRecords.forEach((issue) => {
    if (!issue.visitId) return
    const current = map.get(issue.visitId) ?? 0
    map.set(issue.visitId, current + 1)
  })

  return map
}

export function buildVisitAnalytics({ visits = [], issues = [], evaluationCriteria = [] } = {}) {
  const completedVisits = visits.filter((visit) => visit.status === 'مكتملة')
  const pendingVisits = visits.filter((visit) => visit.status === 'معلقة')
  const upcomingVisits = visits.filter((visit) => visit.status === 'قادمة')
  const deletingVisits = visits.filter((visit) => visit.status === 'جاري المسح')

  const averageScoreRaw = completedVisits.length
    ? completedVisits.reduce(
        (sum, visit) => sum + calculateWeightedScore(visit.scores ?? {}),
        0,
      ) / completedVisits.length
    : 0

  const issueRecords = buildIssuesSource({ visits, issues }).sort((first, second) => {
    const firstDate = parseVisitDate(first.date)?.getTime() ?? 0
    const secondDate = parseVisitDate(second.date)?.getTime() ?? 0
    return secondDate - firstDate
  })

  const issueSummary = {
    total: issueRecords.length,
    simple: issueRecords.filter((issue) => issue.severity === 'بسيطة').length,
    medium: issueRecords.filter((issue) => issue.severity === 'متوسطة').length,
    critical: issueRecords.filter((issue) => issue.severity === 'خطيرة').length,
  }

  const issuesCountByVisit = countIssuesByVisit(issueRecords)

  const visitRows = [...visits]
    .map((visit) => ({
      ...visit,
      officeName: normalizeText(visit.officeName),
      city: normalizeText(visit.city),
      score: roundTo(calculateWeightedScore(visit.scores ?? {})),
      issuesCount: Number(issuesCountByVisit.get(visit.id) ?? visit.issues?.length ?? 0),
      pointsEarned: Number(visit.pointsEarned ?? 0),
    }))
    .sort((first, second) => {
      const firstDate = parseVisitDate(first.date)?.getTime() ?? 0
      const secondDate = parseVisitDate(second.date)?.getTime() ?? 0
      return secondDate - firstDate
    })

  const cityMap = new Map()

  visitRows.forEach((visit) => {
    const cityKey = normalizeText(visit.city, 'غير محدد')

    if (!cityMap.has(cityKey)) {
      cityMap.set(cityKey, {
        city: cityKey,
        total: 0,
        completed: 0,
        scoreSum: 0,
        scoreCount: 0,
        issues: 0,
      })
    }

    const cityStats = cityMap.get(cityKey)
    cityStats.total += 1
    cityStats.issues += visit.issuesCount

    if (visit.status === 'مكتملة') {
      cityStats.completed += 1
      cityStats.scoreSum += visit.score
      cityStats.scoreCount += 1
    }
  })

  const cityPerformance = Array.from(cityMap.values())
    .map((cityStats) => {
      const average = cityStats.scoreCount ? cityStats.scoreSum / cityStats.scoreCount : 0

      return {
        city: cityStats.city,
        total: cityStats.total,
        completed: cityStats.completed,
        completionRate: cityStats.total ? Math.round((cityStats.completed / cityStats.total) * 100) : 0,
        average: roundTo(average),
        issues: cityStats.issues,
      }
    })
    .sort((first, second) => second.total - first.total)

  const topCities = cityPerformance.slice(0, 6)
  const remainingVisits = cityPerformance.slice(6).reduce((sum, city) => sum + city.total, 0)

  const cityShare = topCities.map((city, index) => ({
    name: city.city,
    value: city.total,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }))

  if (remainingVisits > 0) {
    cityShare.push({
      name: 'مدن أخرى',
      value: remainingVisits,
      color: '#94a3b8',
    })
  }

  const cityRatingBars = [...cityPerformance]
    .sort((first, second) => second.average - first.average)
    .slice(0, 8)

  const monthKeys = buildMonthKeys({ visits, months: 6 })
  const monthlyMap = new Map(
    monthKeys.map((monthKey) => [
      monthKey,
      {
        visits: 0,
        completed: 0,
        scoreSum: 0,
      },
    ]),
  )

  visitRows.forEach((visit) => {
    const visitDate = parseVisitDate(visit.date)
    if (!visitDate) return

    const monthKey = getMonthKey(visitDate)
    if (!monthlyMap.has(monthKey)) return

    const monthStats = monthlyMap.get(monthKey)
    monthStats.visits += 1

    if (visit.status === 'مكتملة') {
      monthStats.completed += 1
      monthStats.scoreSum += visit.score
    }
  })

  const volumeTrend = monthKeys.map((monthKey) => ({
    month: getMonthLabel(monthKey),
    visits: monthlyMap.get(monthKey)?.visits ?? 0,
  }))

  const performanceTrend = monthKeys.map((monthKey) => {
    const monthStats = monthlyMap.get(monthKey)
    const averageScore = monthStats?.completed
      ? monthStats.scoreSum / monthStats.completed
      : 0

    return {
      month: getMonthLabel(monthKey),
      averageScore: roundTo(averageScore),
    }
  })

  const criteriaPerformance = evaluationCriteria.map((criterion) => {
    const average = completedVisits.length
      ? completedVisits.reduce(
          (sum, visit) => sum + Number(visit.scores?.[criterion.key] ?? 0),
          0,
        ) / completedVisits.length
      : 0

    return {
      key: criterion.key,
      label: criterion.label,
      average: roundTo(average),
    }
  })

  const completionRate = visitRows.length
    ? Math.round((completedVisits.length / visitRows.length) * 100)
    : 0

  return {
    statusCounts: {
      total: visitRows.length,
      completed: completedVisits.length,
      pending: pendingVisits.length,
      upcoming: upcomingVisits.length,
      deleting: deletingVisits.length,
    },
    completionRate,
    averageScore: roundTo(averageScoreRaw),
    issueSummary,
    issueRecords,
    visitRows,
    cityPerformance,
    cityShare,
    cityRatingBars,
    volumeTrend,
    performanceTrend,
    criteriaPerformance,
  }
}
