import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  LayoutGrid,
  LogIn,
  ShieldCheck,
} from 'lucide-react'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [portal, setPortal] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const isShopperPortal = portal === 'shopper'
  const isManagerPortal = portal === 'manager'

  const handleSelectPortal = (nextPortal) => {
    setPortal(nextPortal)
    setEmail('')
    setPassword('')
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!portal) return

    const user = onLogin(email, password, { commit: false })

    if (!user) {
      setError('بيانات الدخول غير صحيحة. يرجى المحاولة مرة أخرى.')
      return
    }

    if (isShopperPortal && user.role !== 'shopper') {
      setError('هذا الحساب يتبع مدير النظام. اختر أيقونة مدير النظام.')
      return
    }

    if (isManagerPortal && user.role === 'shopper') {
      setError('هذا الحساب خاص بالمتسوق. اختر أيقونة متسوق سري.')
      return
    }

    const committedUser = onLogin(email, password, { commit: true })

    if (!committedUser) {
      setError('تعذر إتمام تسجيل الدخول. حاول مرة أخرى.')
      return
    }

    if (committedUser.role === 'superadmin') {
      navigate('/superadmin/overview', { replace: true })
      return
    }

    if (committedUser.role === 'admin') {
      navigate('/admin/overview', { replace: true })
      return
    }

    if (committedUser.role === 'ops') {
      navigate('/ops/overview', { replace: true })
      return
    }

    navigate('/shopper/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <section className="text-center">
          <img
            src="/branding/nhc-logo.png"
            alt="NHC"
            className="mx-auto h-20 w-20 object-contain"
          />
          <h1 className="mt-4 font-display text-5xl font-black text-slate-900 max-md:text-4xl">
            نظام المتسوق السري
          </h1>
          <p className="mt-2 text-lg text-slate-500">اختر دورك للدخول إلى النظام</p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleSelectPortal('shopper')}
            className={`rounded-3xl border bg-white p-7 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              isShopperPortal
                ? 'border-blue-400 ring-2 ring-blue-200'
                : 'border-slate-200'
            }`}
          >
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500 text-white shadow-sm">
              <ClipboardCheck className="h-10 w-10" />
            </span>
            <h2 className="mt-5 text-4xl font-black text-slate-900 max-md:text-3xl">متسوق سري</h2>
            <p className="mt-2 text-base text-slate-500">تنفيذ الزيارات وإعداد التقييمات</p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectPortal('manager')}
            className={`rounded-3xl border bg-white p-7 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              isManagerPortal
                ? 'border-emerald-400 ring-2 ring-emerald-200'
                : 'border-slate-200'
            }`}
          >
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-700 text-white shadow-sm">
              <LayoutGrid className="h-10 w-10" />
            </span>
            <h2 className="mt-5 text-4xl font-black text-slate-900 max-md:text-3xl">مدير النظام</h2>
            <p className="mt-2 text-base text-slate-500">إدارة المشاريع والفرق ومتابعة الأداء</p>
          </button>
        </section>

        {portal && (
          <section className="mx-auto mt-6 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-2xl font-black text-slate-900">تسجيل الدخول</h3>
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
                {isShopperPortal ? 'متسوق سري' : 'مدير النظام'}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="example@nhc.sa"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-bold text-white transition hover:bg-indigo-700"
              >
                <LogIn className="h-4 w-4" />
                دخول المنصة
              </button>
            </form>
          </section>
        )}

        <div className="mt-6 text-center">
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            <ShieldCheck className="me-2 h-4 w-4" />
            محمي باتفاقية عدم الإفصاح
          </span>
        </div>
      </div>
    </div>
  )
}
