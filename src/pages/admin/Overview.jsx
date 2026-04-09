import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Coins,
  Gauge,
  Star,
  Users2,
} from 'lucide-react'
import { memo } from 'react'
import { useOutletContext } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import PointsBadge from '../../components/PointsBadge'
import ScoreBar from '../../components/ScoreBar'
import useDashboardStats from '../../hooks/useDashboardStats'
import { calculateWeightedScore, getScoreClasses } from '../../utils/scoring'

const statusStyles = {
  مكتملة: 'bg-emerald-500',
  قادمة: 'bg-amber-500',
  معلقة: 'bg-slate-700',
}

const LeaderboardRow = memo(function LeaderboardRow({ shopper, index }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-black text-white">
        #{index + 1}
      </div>
      <Avatar name={shopper.name} size="sm" />
      <div>
        <p className="font-bold text-slate-900">{shopper.name}</p>
        <p className="text-sm text-slate-500">{shopper.email}</p>
      </div>
      <div className="ms-auto text-sm text-slate-500">{shopper.visits} زيارات</div>
      <PointsBadge points={shopper.points} />
    </div>
  )
})

export default function Overview() {
  const { shoppers, visits, issues, user, adminHasAssignments, dataLoading, dataError } =
    useOutletContext()

  const stats = useDashboardStats({ shoppers, visits, issues })

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (user?.role === 'admin' && !adminHasAssignments) {
    return <EmptyState icon={Users2} message="لم يتم تعيين متسوقين بعد" />
  }

  if (shoppers.length === 0 && visits.length === 0) {
    return <EmptyState icon={Gauge} message="لا توجد بيانات متاحة حالياً" />
  }

  const completedVisits = visits.filter((visit) => visit.status === 'مكتملة')

  const todayDate = new Date().toISOString().slice(0, 10)
  const visitsToday = visits.filter((visit) => visit.date === todayDate).length

  const kpiCards = [
    {
      label: 'إجمالي النقاط',
      value: stats.totalPoints.toLocaleString('en-US'),
      hint: '+12% مقارنة بالشهر الماضي',
      icon: Coins,
      styles: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      label: 'معدل التقييم',
      value: `${stats.avgRating.toFixed(2)} / 5`,
      hint: 'جودة الأداء العام',
      icon: Star,
      styles: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      progress: (stats.avgRating / 5) * 100,
    },
    {
      label: 'إجمالي الزيارات',
      value: stats.totalVisits,
      hint: `${stats.completedVisits} مكتملة`,
      icon: CalendarCheck2,
      styles: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    },
    {
      label: 'إجمالي المتسوقين',
      value: shoppers.length,
      hint: `${stats.activeShoppers} نشط`,
      icon: Users2,
      styles: 'bg-sky-50 text-sky-700 border-sky-200',
    },
  ]

  const recentCompleted = [...completedVisits]
    .sort((first, second) =>
      `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`),
    )
    .slice(0, 5)

  const topShoppers = [...shoppers]
    .sort((first, second) => second.points - first.points)
    .slice(0, 5)

  const statusData = [
    { label: 'مكتملة', count: stats.completedVisits },
    { label: 'قادمة', count: stats.upcomingVisits },
    { label: 'معلقة', count: stats.pendingVisits },
  ]

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-700 via-purple-600 to-pink-500 p-6 text-white shadow-sm">
        <div className="absolute -start-16 -top-16 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -end-12 -bottom-16 h-48 w-48 rounded-full bg-fuchsia-300/30 blur-2xl" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-3xl font-black">لوحة تحكم المدير الفرعي</h2>
              <p className="text-sm text-white/85">
                نظرة شاملة على برنامج المتحري الخفي
              </p>
            </div>

            <div className="ms-auto inline-flex items-center rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-bold">
              <CheckCircle2 className="me-2 h-4 w-4" />
              النظام يعمل بكفاءة
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">زيارات اليوم</p>
              <p className="mt-1 text-xl font-black">{visitsToday}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">تقييمات جديدة</p>
              <p className="mt-1 text-xl font-black">{stats.completedVisits}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">نقاط موزعة</p>
              <p className="mt-1 text-xl font-black">
                {completedVisits
                  .reduce((sum, visit) => sum + (visit.pointsEarned ?? 0), 0)
                  .toLocaleString('en-US')}
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">معدل الإنجاز</p>
              <p className="mt-1 text-xl font-black">{stats.completionRate}%</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <p className="text-xs text-white/80">المشاكل المكتشفة</p>
              <p className="mt-1 text-xl font-black">{stats.issuesTotal}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon

          return (
            <article
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
                </div>
                <span
                  className={`rounded-xl border px-2 py-1 text-xs font-bold ${card.styles}`}
                >
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{card.hint}</p>
              {typeof card.progress === 'number' && (
                <ScoreBar value={card.progress} max={100} showValue={false} className="mt-3" />
              )}
            </article>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-black text-rose-900">المشاكل المكتشفة</h3>
            <AlertTriangle className="h-5 w-5 text-rose-700" />
          </div>
          <p className="mt-2 text-3xl font-black text-rose-800">{stats.issuesTotal}</p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-xs text-emerald-700">بسيطة</p>
              <p className="text-xl font-black text-emerald-800">{stats.issuesCounts.simple}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-700">متوسطة</p>
              <p className="text-xl font-black text-amber-800">{stats.issuesCounts.medium}</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-100 p-3 text-center">
              <p className="text-xs text-rose-700">خطيرة</p>
              <p className="text-xl font-black text-rose-800">{stats.issuesCounts.critical}</p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-black text-slate-900">حالة الزيارات</h3>
            <Gauge className="h-5 w-5 text-slate-600" />
          </div>
          <div className="mt-4 space-y-3">
            {statusData.map((item) => {
              const percentage = visits.length
                ? Math.round((item.count / visits.length) * 100)
                : 0

              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                    <span>{item.label}</span>
                    <span>
                      {item.count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${statusStyles[item.label]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-display text-xl font-black text-slate-900">
            آخر الزيارات المكتملة
          </h3>
          <div className="mt-4 space-y-3">
            {recentCompleted.map((visit) => {
              const rating = calculateWeightedScore(visit.scores)

              return (
                <div
                  key={visit.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{visit.officeName}</p>
                      <p className="text-sm text-slate-500">
                        {visit.type} • {visit.city}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getScoreClasses(
                        rating,
                      )}`}
                    >
                      {rating.toFixed(2)} / 5
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-500">
                      {visit.date} • {visit.time}
                    </p>
                    <PointsBadge points={visit.pointsEarned ?? 0} />
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-display text-xl font-black text-slate-900">
            أفضل المتسوقين
          </h3>
          <div className="mt-4 space-y-3">
            {topShoppers.map((shopper, index) => (
              <LeaderboardRow key={shopper.id} shopper={shopper} index={index} />
            ))}

            {topShoppers.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                لا توجد بيانات متاحة حالياً.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
