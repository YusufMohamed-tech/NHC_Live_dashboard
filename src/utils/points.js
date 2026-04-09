export const POINTS_SYSTEM = {
  completeVisit: 50,
  uploadImage: 5,
  uploadVideo: 10,
  issueSimple: 15,
  issueMedium: 30,
  issueCritical: 50,
  comprehensiveReport: 25,
  fastCompletion: 15,
  accurateInfo: 20,
  milestone5: 50,
  milestone10: 100,
  milestone20: 200,
}

function getMilestonePoints(totalVisits) {
  if (totalVisits === 20) {
    return POINTS_SYSTEM.milestone20
  }

  if (totalVisits === 10) {
    return POINTS_SYSTEM.milestone10
  }

  if (totalVisits === 5) {
    return POINTS_SYSTEM.milestone5
  }

  return 0
}

export function calculateVisitPoints({
  images = 0,
  videos = 0,
  issueSeverity = [],
  hasComprehensiveReport = false,
  isFastCompletion = false,
  hasAccurateInfo = false,
  completedVisits = 0,
} = {}) {
  let total = POINTS_SYSTEM.completeVisit

  total += images * POINTS_SYSTEM.uploadImage
  total += videos * POINTS_SYSTEM.uploadVideo

  issueSeverity.forEach((severity) => {
    if (severity === 'بسيطة') {
      total += POINTS_SYSTEM.issueSimple
    } else if (severity === 'متوسطة') {
      total += POINTS_SYSTEM.issueMedium
    } else if (severity === 'خطيرة') {
      total += POINTS_SYSTEM.issueCritical
    }
  })

  if (hasComprehensiveReport) {
    total += POINTS_SYSTEM.comprehensiveReport
  }

  if (isFastCompletion) {
    total += POINTS_SYSTEM.fastCompletion
  }

  if (hasAccurateInfo) {
    total += POINTS_SYSTEM.accurateInfo
  }

  total += getMilestonePoints(completedVisits)

  return total
}
