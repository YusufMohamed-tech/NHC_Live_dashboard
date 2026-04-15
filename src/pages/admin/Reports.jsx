import {
  AlertTriangle,
  BarChart3,
  CalendarCheck2,
  Download,
  Gauge,
  LoaderCircle,
  MapPinned,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import ReportHeader from '../../components/ReportHeader'
import StatusBadge from '../../components/StatusBadge'
import useDashboardStats from '../../hooks/useDashboardStats'
import {
  generateMysteryShopperDetailedPdf,
  generateMysteryShopperPdf,
} from '../../utils/reportsPdf'
import { buildVisitAnalytics } from '../../utils/visitAnalytics'

const SHOW_POINTS_SECTION = import.meta.env.DEV

const subTabs = [
  { key: 'overview', label: 'لوحة الزيارات' },
  { key: 'visits', label: 'سجل الزيارات' },
  { key: 'regions', label: 'تحليل المناطق' },
  { key: 'issues', label: 'التحديات' },
]

const kpiToneClasses = {
  emerald: {
    card: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-emerald-600 text-white',
    value: 'text-emerald-800',
  },
  indigo: {
    card: 'border-indigo-200 bg-indigo-50',
    icon: 'bg-indigo-600 text-white',
    value: 'text-indigo-800',
  },
  sky: {
    card: 'border-sky-200 bg-sky-50',
    icon: 'bg-sky-600 text-white',
    value: 'text-sky-800',
  },
  rose: {
    card: 'border-rose-200 bg-rose-50',
    icon: 'bg-rose-600 text-white',
    value: 'text-rose-800',
  },
}

function getScoreCellClasses(score) {
  if (score >= 4) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (score >= 2.5) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-rose-100 text-rose-700 border-rose-200'
}

function KpiCard({ title, value, hint, icon, tone = 'emerald' }) {
  const Icon = icon
  const classes = kpiToneClasses[tone] ?? kpiToneClasses.emerald

  return (
    <article className={`rounded-xl border p-4 ${classes.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-600">{title}</p>
          <p className={`mt-2 text-3xl font-black ${classes.value}`}>{value}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{hint}</p>
        </div>
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${classes.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </article>
  )
}

function ChartCard({ title, subtitle, icon, children }) {
  const Icon = icon
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-black text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 h-72">{children}</div>
    </article>
  )
}

export default function Reports() {
  const {
    user,
    shoppers,
    visits,
    issues,
    evaluationCriteria,
    dataLoading,
    dataError,
  } = useOutletContext()

  const [activeSubTab, setActiveSubTab] = useState('overview')
  const [exportMode, setExportMode] = useState('')
  const [toast, setToast] = useState({ type: '', message: '' })

  useEffect(() => {
    if (!toast.message) return undefined

    const timeout = window.setTimeout(() => {
      setToast({ type: '', message: '' })
    }, 2600)

    return () => window.clearTimeout(timeout)
  }, [toast])

  const dashboardStats = useDashboardStats({ shoppers, visits, issues })

  const analytics = useMemo(
    () => buildVisitAnalytics({ visits, issues, evaluationCriteria }),
    [evaluationCriteria, issues, visits],
  )

  const canExportPdf = ['superadmin', 'admin', 'ops'].includes(user?.role)
  const isExporting = exportMode !== ''

  const regionsSummary = useMemo(() => {
    const byVolume = analytics.cityPerformance[0] ?? null

    const byScore = [...analytics.cityPerformance]
      .filter((row) => row.completed > 0)
      .sort((first, second) => second.average - first.average)[0] ?? null

    const weakScore = [...analytics.cityPerformance]
      .filter((row) => row.completed > 0)
      .sort((first, second) => first.average - second.average)[0] ?? null

    return {
      byVolume,
      byScore,
      weakScore,
    }
  }, [analytics.cityPerformance])

  const handleSummaryExport = async () => {
    if (!canExportPdf || isExporting) return

    setExportMode('summary')

    try {
      await generateMysteryShopperPdf({
        visits,
        issues,
        evaluationCriteria,
        showPointsSection: SHOW_POINTS_SECTION,
      })

      setToast({ type: 'success', message: 'تم إصدار التقرير بنجاح' })
    } catch {
      setToast({ type: 'error', message: 'تعذر إنشاء التقرير، حاول مرة أخرى' })
    } finally {
      setExportMode('')
    }
  }

  const handleDetailedExport = async () => {
    if (!canExportPdf || isExporting) return

    setExportMode('detailed')

    try {
      await generateMysteryShopperDetailedPdf({
        visits,
        issues,
        evaluationCriteria,
        showPointsSection: SHOW_POINTS_SECTION,
      })

      setToast({ type: 'success', message: 'تم إصدار التقرير التفصيلي بنجاح' })
    } catch {
      setToast({ type: 'error', message: 'تعذر إنشاء التقرير التفصيلي، حاول مرة أخرى' })
    } finally {
      setExportMode('')
    }
  }

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (visits.length === 0) {
    return <EmptyState icon={BarChart3} message="لا توجد بيانات زيارات كافية لعرض التقارير" />
  }

  return (
    <div className="space-y-4">
      {toast.message && (
        <div className="fixed end-4 top-4 z-50">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-lg ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ReportHeader />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">تقارير الزيارات التحليلية</h2>
            <p className="text-sm text-slate-500">
              لوحة متابعة شبيهة بـ Power BI مبنية على نفس أرقام لوحة التحكم
            </p>
          </div>

          {canExportPdf && (
            <div className="ms-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSummaryExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {exportMode === 'summary' ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    جاري إصدار التقرير...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    إصدار تقرير
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDetailedExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {exportMode === 'detailed' ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    جاري إصدار التقرير التفصيلي...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    إصدار تقرير تفصيلي
                  </>
                )}
              </button>
            </div>
          )}
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
            <KpiCard
              title="إجمالي الزيارات"
              value={dashboardStats.totalVisits}
              hint={`${analytics.statusCounts.pending + analytics.statusCounts.upcoming} زيارة نشطة`}
              icon={CalendarCheck2}
              tone="indigo"
            />
            <KpiCard
              title="الزيارات المكتملة"
              value={dashboardStats.completedVisits}
              hint={`${analytics.statusCounts.deleting} طلب مسح`}
              icon={Gauge}
              tone="emerald"
            />
            <KpiCard
              title="متوسط الأداء"
              value={`${dashboardStats.avgRating.toFixed(2)} / 5`}
              hint="متوسط تقييم الزيارات المكتملة"
              icon={TrendingUp}
              tone="sky"
            />
            <KpiCard
              title="معدل الإنجاز"
              value={`${dashboardStats.completionRate}%`}
              hint={`${dashboardStats.issuesTotal} تحدي موثق`}
              icon={AlertTriangle}
              tone="rose"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="الأداء حسب المنطقة"
              subtitle="توزيع إجمالي الزيارات على المدن"
              icon={MapPinned}
            >
              {analytics.cityShare.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.cityShare}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {analytics.cityShare.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} زيارة`, 'إجمالي الزيارات']} />
                    <Legend verticalAlign="bottom" height={24} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  لا توجد بيانات كافية لعرض الرسم.
                </p>
              )}
            </ChartCard>

            <ChartCard
              title="أداء التقييم"
              subtitle="متوسط التقييم الشهري للزيارات المكتملة"
              icon={TrendingUp}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.performanceTrend} margin={{ top: 16, right: 20, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 5]} tickCount={6} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} / 5`, 'متوسط الأداء']} />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    stroke="#0f766e"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#0f766e' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="التقييم حسب المنطقة"
              subtitle="أفضل 8 مدن حسب متوسط التقييم"
              icon={BarChart3}
            >
              {analytics.cityRatingBars.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.cityRatingBars}
                    layout="vertical"
                    margin={{ top: 6, right: 20, left: 12, bottom: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} />
                    <YAxis dataKey="city" type="category" width={84} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} / 5`, 'متوسط التقييم']} />
                    <Bar dataKey="average" fill="#0f766e" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">
                  لا توجد بيانات مكتملة كافية لعرض الرسم.
                </p>
              )}
            </ChartCard>

            <ChartCard
              title="عدد الزيارات"
              subtitle="حجم الزيارات خلال آخر 6 أشهر"
              icon={CalendarCheck2}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.volumeTrend} margin={{ top: 14, right: 16, left: 0, bottom: 6 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} زيارة`, 'العدد']} />
                  <Bar dataKey="visits" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </section>
      )}

      {activeSubTab === 'visits' && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="font-display text-lg font-black text-slate-900">سجل الزيارات التفصيلي</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-start font-black">الفرع</th>
                  <th className="px-4 py-3 text-start font-black">المدينة</th>
                  <th className="px-4 py-3 text-start font-black">التاريخ</th>
                  <th className="px-4 py-3 text-start font-black">الحالة</th>
                  <th className="px-4 py-3 text-start font-black">التقييم</th>
                  <th className="px-4 py-3 text-start font-black">التحديات</th>
                  {SHOW_POINTS_SECTION && <th className="px-4 py-3 text-start font-black">النقاط</th>}
                </tr>
              </thead>
              <tbody>
                {analytics.visitRows.map((visit, index) => (
                  <tr
                    key={visit.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">{visit.officeName}</td>
                    <td className="px-4 py-3 text-slate-600">{visit.city}</td>
                    <td className="px-4 py-3 text-slate-600">{visit.date}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={visit.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getScoreCellClasses(
                          visit.score,
                        )}`}
                      >
                        {visit.score.toFixed(2)} / 5
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">{visit.issuesCount}</td>
                    {SHOW_POINTS_SECTION && (
                      <td className="px-4 py-3 font-bold text-amber-700">{visit.pointsEarned}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSubTab === 'regions' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">الأكثر نشاطاً</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{regionsSummary.byVolume?.city ?? '-'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {regionsSummary.byVolume ? `${regionsSummary.byVolume.total} زيارة` : 'لا توجد بيانات'}
              </p>
            </article>

            <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <p className="text-xs font-bold text-emerald-700">الأفضل تقييماً</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">{regionsSummary.byScore?.city ?? '-'}</p>
              <p className="mt-1 text-xs text-emerald-700">
                {regionsSummary.byScore
                  ? `${regionsSummary.byScore.average.toFixed(2)} / 5`
                  : 'لا توجد زيارات مكتملة'}
              </p>
            </article>

            <article className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
              <p className="text-xs font-bold text-rose-700">فرصة تحسين</p>
              <p className="mt-1 text-2xl font-black text-rose-800">{regionsSummary.weakScore?.city ?? '-'}</p>
              <p className="mt-1 text-xs text-rose-700">
                {regionsSummary.weakScore
                  ? `${regionsSummary.weakScore.average.toFixed(2)} / 5`
                  : 'لا توجد زيارات مكتملة'}
              </p>
            </article>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-display text-lg font-black text-slate-900">تحليل الزيارات حسب المنطقة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-start font-black">المدينة</th>
                    <th className="px-4 py-3 text-start font-black">إجمالي الزيارات</th>
                    <th className="px-4 py-3 text-start font-black">المكتملة</th>
                    <th className="px-4 py-3 text-start font-black">معدل الإنجاز</th>
                    <th className="px-4 py-3 text-start font-black">متوسط التقييم</th>
                    <th className="px-4 py-3 text-start font-black">التحديات</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.cityPerformance.map((row, index) => (
                    <tr
                      key={row.city}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.city}</td>
                      <td className="px-4 py-3 text-slate-600">{row.total}</td>
                      <td className="px-4 py-3 text-slate-600">{row.completed}</td>
                      <td className="px-4 py-3 text-slate-600">{row.completionRate}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-bold ${getScoreCellClasses(
                            row.average,
                          )}`}
                        >
                          {row.average.toFixed(2)} / 5
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-rose-700">{row.issues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {activeSubTab === 'issues' && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">إجمالي التحديات</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{analytics.issueSummary.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">بسيطة</p>
              <p className="mt-1 text-2xl font-black text-emerald-800">{analytics.issueSummary.simple}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-700">متوسطة</p>
              <p className="mt-1 text-2xl font-black text-amber-800">{analytics.issueSummary.medium}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-xs text-rose-700">خطيرة</p>
              <p className="mt-1 text-2xl font-black text-rose-800">{analytics.issueSummary.critical}</p>
            </div>
          </div>

          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-display text-xl font-black text-slate-900">سجل التحديات المرتبطة بالزيارات</h3>

            <div className="mt-4 space-y-3">
              {analytics.issueRecords.map((issue, index) => (
                <div
                  key={`${issue.visitId}-${issue.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${
                        issue.severity === 'خطيرة'
                          ? 'border-rose-200 bg-rose-100 text-rose-700'
                          : issue.severity === 'متوسطة'
                            ? 'border-amber-200 bg-amber-100 text-amber-700'
                            : 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      }`}
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

              {analytics.issueRecords.length === 0 && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  لا توجد تحديات موثقة حالياً.
                </p>
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  )
}
