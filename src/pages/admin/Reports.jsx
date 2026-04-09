import { BarChart3, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import { calculateWeightedScore } from '../../utils/scoring'

const subTabs = [
  { key: 'overview', label: 'نظرة عامة' },
  { key: 'offices', label: 'تقرير المنشآت' },
  { key: 'shoppers', label: 'تقرير المتسوقين' },
  { key: 'issues', label: 'تقرير المشاكل' },
]

function getSeverityClasses(severity) {
  if (severity === 'خطيرة') return 'bg-rose-100 text-rose-700 border-rose-200'
  if (severity === 'متوسطة') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function getScoreCellClasses(score) {
  if (score >= 4) return 'bg-emerald-100 text-emerald-700'
  if (score >= 1) return 'bg-amber-100 text-amber-700'
  return 'bg-rose-100 text-rose-700'
}

export default function Reports() {
  const { shoppers, visits, issues, offices, evaluationCriteria, dataLoading, dataError } =
    useOutletContext()

  const [activeSubTab, setActiveSubTab] = useState('overview')

  const completedVisits = useMemo(
    () => visits.filter((visit) => visit.status === 'مكتملة'),
    [visits],
  )

  const completionRate = visits.length
    ? Math.round((completedVisits.length / visits.length) * 100)
    : 0

  const averageRating = completedVisits.length
    ? completedVisits.reduce(
        (sum, visit) => sum + calculateWeightedScore(visit.scores),
        0,
      ) / completedVisits.length
    : 0

  const issueRecords = useMemo(() => {
    return issues
  }, [issues])

  const issueSummary = {
    total: issueRecords.length,
    simple: issueRecords.filter((issue) => issue.severity === 'بسيطة').length,
    medium: issueRecords.filter((issue) => issue.severity === 'متوسطة').length,
    critical: issueRecords.filter((issue) => issue.severity === 'خطيرة').length,
  }

  const criteriaAverages = useMemo(() => {
    return evaluationCriteria.map((criterion) => {
      const avg = completedVisits.length
        ? completedVisits.reduce(
            (sum, visit) => sum + Number(visit.scores[criterion.key] ?? 0),
            0,
          ) / completedVisits.length
        : 0

      return { ...criterion, average: Number(avg.toFixed(2)) }
    })
  }, [completedVisits, evaluationCriteria])

  const cityPerformance = useMemo(() => {
    const cityMap = new Map()

    visits.forEach((visit) => {
      if (!cityMap.has(visit.city)) {
        cityMap.set(visit.city, [])
      }

      cityMap.get(visit.city).push(visit)
    })

    return Array.from(cityMap.entries()).map(([city, cityVisits]) => {
      const completedInCity = cityVisits.filter((visit) => visit.status === 'مكتملة')
      const cityAvg = completedInCity.length
        ? completedInCity.reduce(
            (sum, visit) => sum + calculateWeightedScore(visit.scores),
            0,
          ) / completedInCity.length
        : 0

      return {
        city,
        total: cityVisits.length,
        completed: completedInCity.length,
        average: Number(cityAvg.toFixed(2)),
      }
    })
  }, [visits])

  const shopperRows = useMemo(() => {
    return shoppers.map((shopper) => {
      const shopperVisits = visits.filter((visit) => visit.assignedShopperId === shopper.id)
      const shopperCompleted = shopperVisits.filter((visit) => visit.status === 'مكتملة')
      const avg = shopperCompleted.length
        ? shopperCompleted.reduce(
            (sum, visit) => sum + calculateWeightedScore(visit.scores),
            0,
          ) / shopperCompleted.length
        : 0

      return {
        ...shopper,
        visitsCount: shopperVisits.length,
        averageRating: Number(avg.toFixed(2)),
      }
    })
  }, [shoppers, visits])

  const officesRows = useMemo(() => {
    return offices
      .map((office) => {
        const officeVisits = visits.filter((visit) => visit.officeName === office.name)
        const officeCompleted = officeVisits.filter((visit) => visit.status === 'مكتملة')
        const avg = officeCompleted.length
          ? officeCompleted.reduce(
              (sum, visit) => sum + calculateWeightedScore(visit.scores),
              0,
            ) / officeCompleted.length
          : 0

        const criteriaScores = evaluationCriteria.map((criterion) => {
          const criterionAvg = officeCompleted.length
            ? officeCompleted.reduce(
                (sum, visit) => sum + Number(visit.scores[criterion.key] ?? 0),
                0,
              ) / officeCompleted.length
            : 0

          return {
            label: criterion.label,
            avg: Number(criterionAvg.toFixed(2)),
          }
        })

        const sortedCriteria = [...criteriaScores].sort((first, second) => second.avg - first.avg)

        return {
          officeName: office.name,
          city: office.city,
          visitsCount: officeVisits.length,
          average: Number(avg.toFixed(2)),
          best: sortedCriteria[0]?.label ?? '-',
          weak: sortedCriteria[sortedCriteria.length - 1]?.label ?? '-',
        }
      })
      .sort((first, second) => second.average - first.average)
  }, [offices, visits, evaluationCriteria])

  const chartData = shopperRows.map((shopper) => ({
    name: shopper.name.split(' ')[0],
    points: shopper.points,
  }))

  const toCsv = (rows) => {
    return rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\n')
  }

  const handleExport = () => {
    const summaryRows = [
      ['نوع التقرير', 'القيمة'],
      ['الزيارات المكتملة', completedVisits.length],
      ['متوسط التقييم', averageRating.toFixed(2)],
      ['إجمالي المشاكل', issueSummary.total],
      ['معدل الإكمال', `${completionRate}%`],
    ]

    const shoppersRows = [
      ['المتسوق', 'الزيارات', 'متوسط التقييم', 'النقاط', 'الحالة'],
      ...shopperRows.map((row) => [
        row.name,
        row.visitsCount,
        row.averageRating.toFixed(2),
        row.points,
        row.status,
      ]),
    ]

    const officesCsvRows = [
      ['المنشأة', 'المدينة', 'عدد الزيارات', 'متوسط التقييم', 'أفضل معيار', 'أضعف معيار'],
      ...officesRows.map((row) => [
        row.officeName,
        row.city,
        row.visitsCount,
        row.average.toFixed(2),
        row.best,
        row.weak,
      ]),
    ]

    const issuesRows = [
      ['المنشأة', 'المدينة', 'التاريخ', 'الحدة', 'الوصف'],
      ...issueRecords.map((issue) => [
        issue.officeName,
        issue.city,
        issue.date,
        issue.severity,
        issue.description,
      ]),
    ]

    const csvContent = [
      toCsv(summaryRows),
      '',
      toCsv(shoppersRows),
      '',
      toCsv(officesCsvRows),
      '',
      toCsv(issuesRows),
    ].join('\n')

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'nhc-live-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (shoppers.length === 0 && visits.length === 0) {
    return <EmptyState icon={BarChart3} message="لا توجد بيانات كافية لعرض التقارير" />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">التقارير والإحصائيات</h2>
            <p className="text-sm text-slate-500">لوحات تحليلية تفصيلية لمتابعة الأداء</p>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="ms-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            تصدير التقرير ⬇
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {subTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSubTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeSubTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeSubTab === 'overview' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs text-sky-700">الزيارات المكتملة</p>
              <p className="mt-1 text-2xl font-black text-sky-800">{completedVisits.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">متوسط التقييم</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">
                {averageRating.toFixed(2)} / 5
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs text-rose-700">المشاكل المكتشفة</p>
              <p className="mt-1 text-2xl font-black text-rose-800">{issueSummary.total}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs text-indigo-700">معدل الإكمال</p>
              <p className="mt-1 text-2xl font-black text-indigo-800">{completionRate}%</p>
            </div>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-display text-xl font-black text-slate-900">
              متوسط التقييمات حسب المعايير
            </h3>

            <div className="mt-4 space-y-3">
              {criteriaAverages.map((criterion) => {
                const percentage = (criterion.average / 5) * 100
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
          </article>

          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-display text-lg font-black text-slate-900">الأداء حسب المدينة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-start font-black">المدينة</th>
                    <th className="px-4 py-3 text-start font-black">إجمالي الزيارات</th>
                    <th className="px-4 py-3 text-start font-black">المكتملة</th>
                    <th className="px-4 py-3 text-start font-black">متوسط التقييم</th>
                  </tr>
                </thead>
                <tbody>
                  {cityPerformance.map((row, index) => (
                    <tr
                      key={row.city}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}
                    >
                      <td className="px-4 py-3 text-slate-700">{row.city}</td>
                      <td className="px-4 py-3 text-slate-700">{row.total}</td>
                      <td className="px-4 py-3 text-slate-700">{row.completed}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getScoreCellClasses(
                            row.average,
                          )}`}
                        >
                          {row.average.toFixed(2)} / 5
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {activeSubTab === 'shoppers' && (
        <section className="space-y-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-display text-xl font-black text-slate-900">
              النقاط لكل متسوق
            </h3>
            <div className="mt-4 h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} نقطة`, 'النقاط']} />
                  <Bar dataKey="points" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-start font-black">المتسوق</th>
                    <th className="px-4 py-3 text-start font-black">الزيارات</th>
                    <th className="px-4 py-3 text-start font-black">متوسط التقييم</th>
                    <th className="px-4 py-3 text-start font-black">النقاط</th>
                    <th className="px-4 py-3 text-start font-black">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {shopperRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                      <td className="px-4 py-3 text-slate-600">{row.visitsCount}</td>
                      <td className="px-4 py-3 text-slate-600">{row.averageRating.toFixed(2)} / 5</td>
                      <td className="px-4 py-3 font-bold text-amber-700">{row.points}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            row.status === 'نشط'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {activeSubTab === 'offices' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="font-display text-lg font-black text-slate-900">ترتيب المنشآت حسب التقييم</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-start font-black">المنشأة</th>
                  <th className="px-4 py-3 text-start font-black">المدينة</th>
                  <th className="px-4 py-3 text-start font-black">عدد الزيارات</th>
                  <th className="px-4 py-3 text-start font-black">متوسط التقييم</th>
                  <th className="px-4 py-3 text-start font-black">أفضل معيار</th>
                  <th className="px-4 py-3 text-start font-black">أضعف معيار</th>
                </tr>
              </thead>
              <tbody>
                {officesRows.map((row, index) => (
                  <tr
                    key={row.officeName}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.officeName}</td>
                    <td className="px-4 py-3 text-slate-600">{row.city}</td>
                    <td className="px-4 py-3 text-slate-600">{row.visitsCount}</td>
                    <td className="px-4 py-3 text-slate-600">{row.average.toFixed(2)} / 5</td>
                    <td className="px-4 py-3 text-emerald-700">{row.best}</td>
                    <td className="px-4 py-3 text-rose-700">{row.weak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSubTab === 'issues' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">إجمالي المشاكل</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{issueSummary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">بسيطة</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">{issueSummary.simple}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-700">متوسطة</p>
              <p className="mt-1 text-2xl font-black text-amber-800">{issueSummary.medium}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs text-rose-700">خطيرة</p>
              <p className="mt-1 text-2xl font-black text-rose-800">{issueSummary.critical}</p>
            </div>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-display text-xl font-black text-slate-900">قائمة المشاكل الموثقة</h3>

            <div className="mt-4 space-y-3">
              {issueRecords.map((issue, index) => (
                <div
                  key={`${issue.visitId}-${issue.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${getSeverityClasses(
                        issue.severity,
                      )}`}
                    >
                      {issue.severity}
                    </span>
                    <span className="text-sm text-slate-500">
                      #{index + 1} • {issue.date}
                    </span>
                  </div>

                  <p className="mt-2 font-semibold text-slate-800">{issue.description}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {issue.officeName} • {issue.city}
                  </p>
                </div>
              ))}

              {issueRecords.length === 0 && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  لا توجد مشاكل موثقة حالياً.
                </p>
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  )
}
