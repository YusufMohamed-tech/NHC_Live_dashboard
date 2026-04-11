import { LogOut, ShieldCheck } from 'lucide-react'

export default function Navbar({ title, user, onLogout, showLiveIndicator = false }) {
  const roleText =
    user?.role === 'superadmin'
      ? 'مدير عام'
      : user?.role === 'admin'
        ? 'مدير فرعي'
        : 'متسوق'

  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-xl font-black text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">برنامج المتحري الخفي</p>
        </div>

        <div className="ms-auto flex items-center gap-2">
          {showLiveIndicator && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
              🟢 مباشر
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4" />
            {user?.name} • {roleText}
          </span>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    </header>
  )
}
