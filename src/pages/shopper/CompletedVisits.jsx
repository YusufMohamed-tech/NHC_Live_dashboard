import { CalendarCheck2, Search, SortAsc, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import PointsBadge from '../../components/PointsBadge'
import StarRating from '../../components/StarRating'
import { calculateWeightedScore } from '../../utils/scoring'

export default function CompletedVisits() {
  const { myVisits, evaluationCriteria, dataLoading, dataError } = useOutletContext()

  const [sortBy, setSortBy] = useState('date')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)

  const completedVisits = myVisits.filter((visit) => visit.status === 'مكتملة')

  const filteredVisits = useMemo(() => {
    const prepared = completedVisits
      .filter((visit) =>
        `${visit.officeName} ${visit.city}`
          .toLowerCase()
          .includes(debouncedQuery.toLowerCase()),
      )
      .map((visit) => ({
        ...visit,
        finalScore: calculateWeightedScore(visit.scores),
      }))

    return prepared.sort((first, second) => {
      if (sortBy === 'score') return second.finalScore - first.finalScore
      if (sortBy === 'points') return (second.pointsEarned ?? 0) - (first.pointsEarned ?? 0)
      return `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`)
    })
  }, [completedVisits, debouncedQuery, sortBy])

  const averageScore = filteredVisits.length
    ? filteredVisits.reduce((sum, visit) => sum + visit.finalScore, 0) / filteredVisits.length
    : 0

  const avgWait = filteredVisits.length
    ? filteredVisits.reduce((sum, visit) => sum + Number(visit.waitMinutes ?? 0), 0) /
      filteredVisits.length
    : 0

  const avgCompliance = filteredVisits.length
    ? filteredVisits.reduce((sum, visit) => sum + Number(visit.scores.criterion7 ?? 0), 0) /
      filteredVisits.length
    : 0

  const summaryCounts = {
    weak: filteredVisits.filter((visit) => visit.finalScore < 3).length,
    medium: filteredVisits.filter(
      (visit) => visit.finalScore >= 3 && visit.finalScore < 4,
    ).length,
    excellent: filteredVisits.filter((visit) => visit.finalScore >= 4).length,
    total: filteredVisits.length,
  }

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!completedVisits.length) {
    return <EmptyState icon={CalendarCheck2} message="لا توجد زيارات مكتملة بعد" />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">متوسط التقييم العام</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{averageScore.toFixed(2)} / 5</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs text-sky-700">متوسط وقت الانتظار</p>
            <p className="mt-1 text-2xl font-black text-sky-800">{avgWait.toFixed(1)} دقيقة</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <p className="text-xs text-indigo-700">متوسط الالتزام بالمعايير</p>
            <p className="mt-1 text-2xl font-black text-indigo-800">{avgCompliance.toFixed(2)} / 5</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
            <SortAsc className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-600">الترتيب:</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-11 flex-1 bg-transparent text-sm outline-none"
            >
              <option value="date">حسب التاريخ</option>
              <option value="score">حسب التقييم</option>
              <option value="points">حسب النقاط</option>
            </select>
          </label>

          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="البحث عن زيارة مكتملة..."
              className="h-11 w-full rounded-xl border border-slate-300 pe-10 ps-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredVisits.map((visit) => (
          <article key={visit.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <h3 className="font-display text-xl font-black text-slate-900">{visit.officeName}</h3>
                <p className="text-sm text-slate-500">
                  {visit.city} • {visit.date} • {visit.time}
                </p>
              </div>

              <PointsBadge points={visit.pointsEarned ?? 0} className="ms-auto" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {evaluationCriteria.map((criterion) => (
                <div key={criterion.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600">{criterion.label}</p>
                  <div className="mt-2">
                    <StarRating value={visit.scores?.[criterion.key] ?? 0} readOnly showValue />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
              {visit.notes || 'لا توجد ملاحظات.'}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <p className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                <Star className="h-4 w-4" />
                {visit.finalScore.toFixed(2)} / 5
              </p>

              <Link
                to={`/shopper/completed/${visit.id}`}
                className="text-sm font-bold text-indigo-600 transition hover:text-indigo-800"
              >
                عرض التقييم الكامل
              </Link>
            </div>
          </article>
        ))}

        {filteredVisits.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            لا توجد زيارات مكتملة مطابقة للبحث.
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="font-display text-lg font-black text-slate-900">ملخص التقييمات</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
            <p className="text-xs text-rose-700">تقييم ضعيف (&lt; 3)</p>
            <p className="mt-1 text-2xl font-black text-rose-800">{summaryCounts.weak}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-xs text-amber-700">متوسط (3 - 3.9)</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{summaryCounts.medium}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
            <p className="text-xs text-emerald-700">ممتاز (+4)</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{summaryCounts.excellent}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-center">
            <p className="text-xs text-slate-600">إجمالي</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{summaryCounts.total}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
