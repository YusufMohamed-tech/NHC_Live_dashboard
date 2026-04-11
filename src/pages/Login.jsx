import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Building2,
  CircleGauge,
  MapPinned,
  ShieldCheck,
  Users,
} from 'lucide-react'
import BrandLockup from '../components/BrandLockup'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const user = onLogin(email, password)

    if (!user) {
      setError('بيانات الدخول غير صحيحة. يرجى المحاولة مرة أخرى.')
      return
    }

    if (user.role === 'superadmin') {
      navigate('/superadmin/overview', { replace: true })
      return
    }

    if (user.role === 'admin') {
      navigate('/admin/overview', { replace: true })
      return
    }

    navigate('/shopper/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto grid min-h-[90vh] max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
        <section className="flex flex-col justify-between p-6 md:p-10">
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-black text-slate-900">
                تسجيل الدخول
              </h1>
              <p className="mt-2 text-slate-500">
                ادخل إلى منصة المتحري الخفي الخاصة بـ NHC
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                className="h-12 w-full rounded-xl bg-indigo-600 text-base font-bold text-white transition hover:bg-indigo-700"
              >
                دخول المنصة
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="mb-3 text-sm font-black text-slate-800">حسابات تجريبية</h2>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="font-bold text-slate-800">Super Admin</p>
                  <p className="text-slate-600">superadmin@nhc.sa / super123</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="font-bold text-slate-800">Sub Admin</p>
                  <p className="text-slate-500">يتم إنشاؤه من خلال لوحة المدير العام</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="font-bold text-slate-800">Shopper</p>
                  <p className="text-slate-500">يتم إنشاؤه من خلال لوحة النظام</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              محمي باتفاقية عدم الإفصاح
            </span>
          </div>
        </section>

        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-fuchsia-600 to-pink-600 p-6 text-white md:p-10">
          <div className="absolute -start-16 top-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
          <div className="absolute -end-16 bottom-10 h-56 w-56 rounded-full bg-amber-300/30 blur-2xl" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-6">
              <BrandLockup light />

              <div>
                <p className="text-sm font-semibold text-white/80">منصة قياس تجربة العملاء</p>
                <h2 className="mt-2 font-display text-4xl font-black leading-tight">
                  برنامج المتحري الخفي
                </h2>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold backdrop-blur-sm">
                  <BadgeCheck className="h-4 w-4" />
                  تقييم شامل
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold backdrop-blur-sm">
                  <CircleGauge className="h-4 w-4" />
                  نظام نقاط
                </span>
                <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-bold backdrop-blur-sm">
                  <MapPinned className="h-4 w-4" />
                  تغطية وطنية
                </span>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <Users className="h-4 w-4" />
                  المتسوقون
                </div>
                <p className="mt-2 text-2xl font-black">20+</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <Building2 className="h-4 w-4" />
                  المدن المغطاة
                </div>
                <p className="mt-2 text-2xl font-black">10</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-sm sm:col-span-2">
                <div className="flex items-center gap-2 text-sm text-white/90">
                  <ShieldCheck className="h-4 w-4" />
                  الزيارات السنوية
                </div>
                <p className="mt-2 text-2xl font-black">500+</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
