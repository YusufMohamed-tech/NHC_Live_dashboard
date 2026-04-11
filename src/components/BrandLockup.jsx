export default function BrandLockup({ compact = false, light = false }) {
  const ringClass = light
    ? 'border-white/25 bg-white/10'
    : 'border-slate-200 bg-white'

  const textMainClass = light ? 'text-white' : 'text-slate-700'
  const textSubClass = light ? 'text-white/80' : 'text-slate-500'

  const imageSize = compact ? 'h-8 w-auto' : 'h-10 w-auto'

  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border px-3 py-2 backdrop-blur-sm">
      <div className={`rounded-xl border px-2 py-1 ${ringClass}`}>
        <img src="/branding/nhc-logo.png" alt="NHC" className={imageSize} />
      </div>

      <div className={`h-8 w-px ${light ? 'bg-white/30' : 'bg-slate-200'}`} />

      <div className={`rounded-xl border px-2 py-1 ${ringClass}`}>
        <img src="/branding/chessboard-logo.jpeg" alt="Chessboard" className={imageSize} />
      </div>

      {!compact && (
        <div className="ms-1 text-right">
          <p className={`text-xs font-black ${textMainClass}`}>NHC × Chessboard</p>
          <p className={`text-[11px] font-semibold ${textSubClass}`}>
            Client | Service Provider
          </p>
        </div>
      )}
    </div>
  )
}
