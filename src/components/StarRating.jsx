import { Star } from 'lucide-react'

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

export default function StarRating({
  value = 0,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  showValue = false,
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-center gap-1" dir="ltr">
        {Array.from({ length: max }).map((_, index) => {
          const active = index < value
          const iconClass = `${sizeMap[size]} ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`

          if (readOnly) {
            return <Star key={index} className={iconClass} />
          }

          return (
            <button
              key={index}
              type="button"
              onClick={() => onChange?.(index + 1)}
              className="rounded-md p-0.5 transition hover:scale-110"
            >
              <Star className={iconClass} />
            </button>
          )
        })}
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-slate-700">{value} / 5</span>
      )}
    </div>
  )
}
