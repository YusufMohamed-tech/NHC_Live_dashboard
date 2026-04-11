import CoBrandLockup from './CoBrandLockup'

export default function Footer() {
  return (
    <footer className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col items-center justify-between gap-3 md:flex-row">
        <p className="text-center text-sm text-slate-500">
          محمي باتفاقية عدم الإفصاح | NDA | NHC Client | Chessboard Service Provider
        </p>
        <CoBrandLockup variant="dark" className="!p-0" />
      </div>
    </footer>
  )
}
