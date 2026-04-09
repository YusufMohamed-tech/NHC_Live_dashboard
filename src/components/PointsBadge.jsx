import { Crown } from 'lucide-react'

export default function PointsBadge({ points, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 ${className}`}
    >
      <Crown className="h-4 w-4" />
      {points} نقطة
    </span>
  )
}
