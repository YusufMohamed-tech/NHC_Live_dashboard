import { AlertTriangle, BarChart3, CalendarCheck2, Star } from 'lucide-react'
import { useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import { calculateWeightedScore } from '../../utils/scoring'

export default function Reports() {
  const { myVisits, evaluationCriteria, dataLoading, dataError } = useOutletContext()

  const completedVisits = useMemo(
    () => myVisits.filter((visit) => visit.status === 'مكتملة'),
    [myVisits],
  )

  const stats = useMemo(() => {
    const averageScore = completedVisits.length
      ? completedVisits.reduce((sum, visit) => sum + calculateWeightedScore(visit.scores), 0) /
        completedVisits.length
      : 0

    const totalIssues = completedVisits.reduce(
      (sum, visit) => sum + Number(visit.issues?.length ?? 0),
      0,
    )

    const totalPoints = completedVisits.reduce(
      (sum, visit) => sum + Number(visit.pointsEarned ?? 0),
      0,
    )

    return {
      averageScore,
      totalIssues,
      totalPoints,
    }
  }, [completedVisits])

  const criteriaAverages = useMemo(() => {
    return evaluationCriteria.map((criterion) => {
      const average = completedVisits.length
        ? completedVisits.reduce(
            (sum, visit) => sum + Number(visit.scores?.[criterion.key] ?? 0),
            0,
          ) / completedVisits.length
        : 0

      return {
        ...criterion,
        average,
      }
    })
  }, [completedVisits, evaluationCriteria])

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!completedVisits.length) {
    return <EmptyState icon={BarChart3} message="لا توجد بيانات كافية لعرض التقارير" />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-2xl font-black text-slate-900">تقاريري</h2>
        <p className="mt-1 text-sm text-slate-500">ملخص أداء الزيارات المكتملة الخاصة بك</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <Star className="h-4 w-4" />
              <p className="text-xs">متوسط التقييم</p>
            </div>
            <p className="mt-1 text-2xl font-black text-emerald-800">
              {stats.averageScore.toFixed(2)} / 5
            </p>
          </article>

          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <CalendarCheck2 className="h-4 w-4" />
              <p className="text-xs">الزيارات المكتملة</p>
            </div>
            <p className="mt-1 text-2xl font-black text-amber-800">{completedVisits.length}</p>
          </article>

          <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs">المشاكل المكتشفة</p>
            </div>
            <p className="mt-1 text-2xl font-black text-rose-800">{stats.totalIssues}</p>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-xl font-black text-slate-900">متوسط المعايير</h3>

        <div className="mt-4 space-y-3">
          {criteriaAverages.map((criterion) => {
            const percentage = Math.round((criterion.average / 5) * 100)
            const colorClass =
              criterion.average >= 4
                ? 'bg-emerald-500'
                : criterion.average >= 2.5
                  ? 'bg-amber-500'
                  : 'bg-rose-500'

            return (
              <div key={criterion.key}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                  <span>{criterion.label}</span>
                  <span>{criterion.average.toFixed(2)} / 5</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          إجمالي النقاط المحققة من الزيارات المكتملة: <span className="font-black">{stats.totalPoints}</span>
        </div>
      </section>
    </div>
  )
}
