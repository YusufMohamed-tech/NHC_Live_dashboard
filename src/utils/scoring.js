const weights = {
  criterion1: 0.1,
  criterion2: 0.2,
  criterion3: 0.2,
  criterion4: 0.15,
  criterion5: 0.15,
  criterion6: 0.1,
  criterion7: 0.1,
}

export function calculateWeightedScore(scores = {}) {
  const total = Object.entries(weights).reduce((sum, [criterion, weight]) => {
    const criterionScore = Number(scores[criterion] ?? 0)
    return sum + criterionScore * weight
  }, 0)

  return Number(total.toFixed(2))
}

export function getScoreColor(score) {
  if (score >= 4) {
    return 'green'
  }

  if (score >= 2.5) {
    return 'amber'
  }

  return 'red'
}

export function getScoreClasses(score) {
  const color = getScoreColor(score)

  if (color === 'green') {
    return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }

  if (color === 'amber') {
    return 'bg-amber-100 text-amber-700 border-amber-200'
  }

  return 'bg-rose-100 text-rose-700 border-rose-200'
}
