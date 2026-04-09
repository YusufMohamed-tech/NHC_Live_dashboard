import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Clock3,
  SquareCheckBig,
  Timer,
} from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import PointsBadge from '../../components/PointsBadge'
import ScoreBar from '../../components/ScoreBar'

export default function Dashboard() {
  const { user, myVisits, dataLoading, dataError } = useOutletContext()

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!myVisits.length) {
    return <EmptyState icon={CalendarDays} message="لا توجد زيارات مخصصة لك بعد" />
  }

  const totalVisits = myVisits.length
  const completedVisits = myVisits.filter((visit) => visit.status === 'مكتملة').length
  const upcomingVisits = myVisits.filter((visit) => visit.status === 'قادمة').length
  const pendingVisits = myVisits.filter((visit) => visit.status === 'معلقة').length

  const completionRate = totalVisits ? Math.round((completedVisits / totalVisits) * 100) : 0

  const issuesCount = myVisits.reduce(
    (sum, visit) => sum + (visit.issues?.length ?? 0),
    0,
  )

  const pointsFromCompleted = myVisits
    .filter((visit) => visit.status === 'مكتملة')
    .reduce((sum, visit) => sum + (visit.pointsEarned ?? 0), 0)

  const avgIssuesPerVisit = totalVisits ? (issuesCount / totalVisits).toFixed(2) : '0.00'
  const avgPointsPerVisit = completedVisits
    ? (pointsFromCompleted / completedVisits).toFixed(1)
    : '0.0'

  const summaryCards = [
    { label: 'إجمالي', value: totalVisits, color: 'text-slate-900 bg-slate-50 border-slate-200' },
    {
      label: 'مكتملة',
      value: completedVisits,
      color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    },
    {
      label: 'قادمة',
      value: upcomingVisits,
      color: 'text-amber-800 bg-amber-50 border-amber-200',
    },
    {
      label: 'قيد الانتظار',
      value: pendingVisits,
      color: 'text-slate-700 bg-slate-100 border-slate-300',
    },
  ]

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-blue-700 via-indigo-600 to-purple-600 p-6 text-white shadow-sm">
        <div className="absolute -start-14 -top-16 h-52 w-52 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -end-16 bottom-0 h-56 w-56 rounded-full bg-amber-300/25 blur-2xl" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-black">مرحباً بعودتك {user.name}</h2>
              <p className="text-sm text-white/85">
                {upcomingVisits} زيارة قادمة • {pendingVisits} زيارة معلقة
              </p>
            </div>

            <span className="inline-flex w-fit items-center rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm font-bold">
              نشط الآن
            </span>

            <PointsBadge points={user.points} className="ms-auto" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/shopper/visits"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50"
            >
              عرض جميع الزيارات
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold">
              <span>معدل الإنجاز</span>
              <span>{completionRate}%</span>
            </div>
            <ScoreBar value={completionRate} max={100} showValue={false} />
            <p className="mt-2 text-sm text-white/90">عدد المشاكل المكتشفة: {issuesCount}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className={`rounded-xl border p-4 shadow-sm ${card.color}`}
          >
            <p className="text-xs">{card.label}</p>
            <p className="mt-2 text-3xl font-black">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl bg-gradient-to-l from-rose-500 to-pink-500 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-display text-xl font-black">المشاكل المكتشفة</h3>
          </div>
          <p className="mt-4 text-4xl font-black">{issuesCount}</p>
          <p className="mt-1 text-sm text-white/90">بمتوسط {avgIssuesPerVisit} لكل زيارة</p>
          <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 text-sm">
            رصدك للمشاكل يساهم في رفع جودة تجربة العميل بشكل مباشر.
          </p>
        </article>

        <article className="rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <SquareCheckBig className="h-5 w-5" />
            <h3 className="font-display text-xl font-black">إجمالي النقاط</h3>
          </div>
          <p className="mt-4 text-4xl font-black">{user.points}</p>
          <p className="mt-1 text-sm text-white/90">بمتوسط {avgPointsPerVisit} لكل زيارة مكتملة</p>
          <p className="mt-4 rounded-xl bg-white/15 px-3 py-2 text-sm">
            أداء ممتاز! استمر بنفس الجودة للوصول إلى ترتيب أعلى.
          </p>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Clock3 className="h-4 w-4" />
            <h4 className="font-bold">الزيارات القادمة</h4>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{upcomingVisits}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Timer className="h-4 w-4" />
            <h4 className="font-bold">الزيارات المعلقة</h4>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{pendingVisits}</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <SquareCheckBig className="h-4 w-4" />
            <h4 className="font-bold">الزيارات المكتملة</h4>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{completedVisits}</p>
        </article>
      </section>
    </div>
  )
}
