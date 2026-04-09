function getProgressColor(percentage) {
  if (percentage >= 70) {
    return 'bg-emerald-500'
  }

  if (percentage >= 40) {
    return 'bg-amber-500'
  }

  return 'bg-rose-500'
}

export default function ScoreBar({
  value,
  max = 100,
  label,
  showValue = true,
  className = '',
}) {
  const safeValue = Number.isFinite(value) ? value : 0
  const percentage = Math.max(0, Math.min(100, (safeValue / max) * 100))

  return (
    <div className={`space-y-1 ${className}`}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm font-medium text-slate-600">
          <span>{label}</span>
          {showValue && <span>{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
            percentage,
          )}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
