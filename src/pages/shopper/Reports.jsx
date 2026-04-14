import {
  AlertTriangle,
  CalendarCheck2,
  Crown,
  Lock,
  Medal,
  Star,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { useMemo } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/DataState'
import { calculateWeightedScore, getScoreClasses } from '../../utils/scoring'
import { getFilePointsFromPath, normalizeVisitFileUrls } from '../../utils/visitFiles'

function getScoreCardTheme(score) {
  if (score >= 4) {
    return {
      card: 'border-emerald-200 bg-emerald-50',
      text: 'text-emerald-800',
      progress: 'bg-emerald-500',
    }
  }

  if (score >= 2.5) {
    return {
      card: 'border-amber-200 bg-amber-50',
      text: 'text-amber-800',
      progress: 'bg-amber-500',
    }
  }

  return {
    card: 'border-rose-200 bg-rose-50',
    text: 'text-rose-800',
    progress: 'bg-rose-500',
  }
}

export default function Reports() {
  const {
    user,
    myVisits,
    pointsRules,
    evaluationCriteria,
    dataLoading,
    dataError,
  } = useOutletContext()

  const completedVisits = useMemo(
    () =>
      [...myVisits]
        .filter((visit) => visit.status === 'مكتملة')
        .sort((first, second) => `${second.date} ${second.time}`.localeCompare(`${first.date} ${first.time}`)),
    [myVisits],
  )

  const averageScore = completedVisits.length
    ? completedVisits.reduce((sum, visit) => sum + calculateWeightedScore(visit.scores), 0) /
      completedVisits.length
    : 0

  const totalIssues = myVisits.reduce((sum, visit) => sum + Number(visit.issues?.length ?? 0), 0)
  const totalVisits = myVisits.length
  const totalPoints = Number(user?.points ?? 0)

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

  const pointsBreakdown = useMemo(() => {
    const completionRulePoints =
      pointsRules?.visits?.find((rule) => rule.label.includes('إكمال'))?.points ?? 50

    const issueRuleMap = {
      بسيطة: pointsRules?.issues?.find((rule) => rule.label.includes('بسيطة'))?.points ?? 15,
      متوسطة: pointsRules?.issues?.find((rule) => rule.label.includes('متوسطة'))?.points ?? 30,
      خطيرة: pointsRules?.issues?.find((rule) => rule.label.includes('خطيرة'))?.points ?? 50,
    }

    const completionPoints = completedVisits.length * completionRulePoints

    const mediaPoints = completedVisits.reduce((sum, visit) => {
      const filePaths = normalizeVisitFileUrls(visit.file_urls)
      return sum + filePaths.reduce((filesSum, path) => filesSum + getFilePointsFromPath(path), 0)
    }, 0)

    const issuePoints = completedVisits.reduce((sum, visit) => {
      const pointsFromVisitIssues = (visit.issues ?? []).reduce(
        (issuesSum, issue) => issuesSum + Number(issueRuleMap[issue.severity] ?? 0),
        0,
      )

      return sum + pointsFromVisitIssues
    }, 0)

    const visitsTotalPoints = completedVisits.reduce(
      (sum, visit) => sum + Number(visit.pointsEarned ?? 0),
      0,
    )

    const qualityPoints = Math.max(0, visitsTotalPoints - completionPoints - mediaPoints - issuePoints)

    return {
      completionPoints,
      mediaPoints,
      issuePoints,
      qualityPoints,
      visitsTotalPoints,
    }
  }, [completedVisits, pointsRules])

  const achievements = [
    {
      id: 'first-visit',
      title: 'زيارة أولى',
      description: 'إتمام أول زيارة ميدانية',
      unlocked: completedVisits.length >= 1,
      icon: Medal,
      color: 'border-amber-300 bg-amber-100 text-amber-700',
    },
    {
      id: 'five-visits',
      title: '5 زيارات',
      description: 'إتمام خمس زيارات',
      unlocked: completedVisits.length >= 5,
      icon: Trophy,
      color: 'border-slate-300 bg-slate-100 text-slate-700',
    },
    {
      id: 'ten-visits',
      title: '10 زيارات',
      description: 'إتمام عشر زيارات',
      unlocked: completedVisits.length >= 10,
      icon: Crown,
      color: 'border-yellow-300 bg-yellow-100 text-yellow-700',
    },
    {
      id: 'distinguished',
      title: 'متسوق مميز',
      description: 'متوسط تقييم 4 فأعلى',
      unlocked: completedVisits.length > 0 && averageScore >= 4,
      icon: Star,
      color: 'border-violet-300 bg-violet-100 text-violet-700',
    },
  ]

  const summaryTheme = getScoreCardTheme(averageScore)

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-2xl font-black text-slate-900">تقاريري</h2>
        <p className="mt-1 text-sm text-slate-500">
          نظرة شاملة على أدائك في برنامج المتحري الخفي
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className={`rounded-xl border p-4 ${summaryTheme.card}`}>
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${summaryTheme.text}`} />
              <p className="text-xs text-slate-600">متوسط تقييمي</p>
            </div>
            <p className={`mt-1 text-2xl font-black ${summaryTheme.text}`}>
              {averageScore.toFixed(2)} / 5
            </p>
          </article>

          <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-center gap-2 text-sky-700">
              <CalendarCheck2 className="h-4 w-4" />
              <p className="text-xs">إجمالي زياراتي</p>
            </div>
            <p className="mt-1 text-2xl font-black text-sky-800">{totalVisits}</p>
          </article>

          <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <Crown className="h-4 w-4" />
              <p className="text-xs">نقاطي الكلية</p>
            </div>
            <p className="mt-1 text-2xl font-black text-amber-800">{totalPoints}</p>
          </article>

          <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs">المشاكل الموثقة</p>
            </div>
            <p className="mt-1 text-2xl font-black text-rose-800">{totalIssues}</p>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-xl font-black text-slate-900">أدائي حسب المعايير السبعة</h3>

        <div className="mt-4 space-y-3">
          {criteriaAverages.map((criterion) => {
            const percentage = Math.round((criterion.average / 5) * 100)
            const theme = getScoreCardTheme(criterion.average)

            return (
              <div key={criterion.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                  <span>{criterion.label}</span>
                  <span>{criterion.average.toFixed(2)} / 5</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${theme.progress}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-xl font-black text-slate-900">سجل زياراتي</h3>

        <div className="mt-4 space-y-3">
          {completedVisits.map((visit) => {
            const score = calculateWeightedScore(visit.scores)

            return (
              <Link
                key={visit.id}
                to={`/shopper/completed/${visit.id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-900">{visit.officeName}</p>
                  <span className="text-sm text-slate-500">{visit.date}</span>

                  <span
                    className={`ms-auto rounded-full border px-3 py-1 text-xs font-bold ${getScoreClasses(
                      score,
                    )}`}
                  >
                    {score.toFixed(2)} / 5
                  </span>

                  <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                    {visit.pointsEarned ?? 0} نقطة
                  </span>
                </div>
              </Link>
            )
          })}

          {completedVisits.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              لا توجد زيارات مكتملة بعد.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-xl font-black text-slate-900">تفاصيل نقاطي</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">نقاط إكمال الزيارات</p>
            <p className="mt-1 text-xl font-black text-slate-900">{pointsBreakdown.completionPoints}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-xs text-sky-700">نقاط الصور والفيديو</p>
            <p className="mt-1 text-xl font-black text-sky-800">{pointsBreakdown.mediaPoints}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-700">نقاط المشاكل الموثقة</p>
            <p className="mt-1 text-xl font-black text-rose-800">{pointsBreakdown.issuePoints}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">نقاط الجودة</p>
            <p className="mt-1 text-xl font-black text-emerald-800">{pointsBreakdown.qualityPoints}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-100 p-4 text-center">
          <p className="text-sm text-amber-700">إجمالي النقاط</p>
          <p className="mt-1 text-3xl font-black text-amber-800">{totalPoints}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-xl font-black text-slate-900">إنجازاتي</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {achievements.map((achievement) => {
            const Icon = achievement.icon

            return (
              <article
                key={achievement.id}
                className={`rounded-xl border p-4 ${
                  achievement.unlocked
                    ? achievement.color
                    : 'border-slate-200 bg-slate-100 text-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5" />
                  {!achievement.unlocked && <Lock className="h-4 w-4" />}
                </div>
                <p className="mt-3 font-black">{achievement.title}</p>
                <p className="mt-1 text-xs">{achievement.description}</p>
              </article>
            )
          })}
        </div>
      </section>

    </div>
  )
}
