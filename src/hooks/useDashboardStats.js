import { useMemo } from 'react'
import { calculateWeightedScore } from '../utils/scoring'

function deriveIssuesFromVisits(visits) {
  return visits.flatMap((visit) => visit.issues ?? [])
}

export default function useDashboardStats({ shoppers = [], visits = [], issues = [] } = {}) {
  return useMemo(() => {
    const completed = visits.filter((visit) => visit.status === 'مكتملة')
    const upcoming = visits.filter((visit) => visit.status === 'قادمة')
    const pending = visits.filter((visit) => visit.status === 'معلقة')

    const totalPoints = shoppers.reduce((sum, shopper) => sum + Number(shopper.points ?? 0), 0)

    const avgRating = completed.length
      ? completed.reduce((sum, visit) => sum + calculateWeightedScore(visit.scores), 0) /
        completed.length
      : 0

    const issuesSource = issues.length ? issues : deriveIssuesFromVisits(visits)

    const issuesCounts = {
      simple: issuesSource.filter((issue) => issue.severity === 'بسيطة').length,
      medium: issuesSource.filter((issue) => issue.severity === 'متوسطة').length,
      critical: issuesSource.filter((issue) => issue.severity === 'خطيرة').length,
    }

    const completionRate = visits.length
      ? Math.round((completed.length / visits.length) * 100)
      : 0

    return {
      totalPoints,
      avgRating,
      totalVisits: visits.length,
      completedVisits: completed.length,
      pendingVisits: pending.length,
      upcomingVisits: upcoming.length,
      issuesCounts,
      issuesTotal: issuesSource.length,
      completionRate,
      activeShoppers: shoppers.filter((shopper) => shopper.status === 'نشط').length,
    }
  }, [issues, shoppers, visits])
}
