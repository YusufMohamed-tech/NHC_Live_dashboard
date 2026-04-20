import { Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/DataState'
import PointsBadge from '../../components/PointsBadge'
import StarRating from '../../components/StarRating'
import StatusBadge from '../../components/StatusBadge'
import { calculateWeightedScore, getScoreClasses } from '../../utils/scoring'

const SHOW_POINTS_SECTION = import.meta.env.DEV

function makeInitialScores(visit, criteria) {
  if (!visit) return {}

  return criteria.reduce((accumulator, criterion) => {
    accumulator[criterion.key] = Number(visit.scores?.[criterion.key] ?? 0)
    return accumulator
  }, {})
}

function makeInitialCriteriaNotes(visit, criteria) {
  if (!visit) return {}

  const savedNotes = visit.scores?.__notes

  return criteria.reduce((accumulator, criterion) => {
    accumulator[criterion.key] =
      typeof savedNotes?.[criterion.key] === 'string' ? savedNotes[criterion.key] : ''
    return accumulator
  }, {})
}

export default function VisitDetail({ fromCompleted = false }) {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const {
    myVisits,
    evaluationCriteria,
    completeVisit,
    dataLoading,
    dataError,
  } = useOutletContext()

  const visit = useMemo(
    () => myVisits.find((item) => item.id === visitId),
    [myVisits, visitId],
  )

  const [scores, setScores] = useState(() => makeInitialScores(visit, evaluationCriteria))
  const [criteriaNotes, setCriteriaNotes] = useState(() =>
    makeInitialCriteriaNotes(visit, evaluationCriteria),
  )
  const [notes, setNotes] = useState(() => visit?.notes ?? '')
  const [error, setError] = useState('')

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!visit) {
    const fallbackPath = fromCompleted ? '/shopper/completed' : '/shopper/visits'

    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">الزيارة غير موجودة أو لا تملك صلاحية الوصول إليها.</p>
        <Link
          to={fallbackPath}
          className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
        >
          العودة إلى الزيارات
        </Link>
      </section>
    )
  }

  const isCompleted = visit.status === 'مكتملة'
  const finalScore = calculateWeightedScore(scores)
  const backPath = fromCompleted || isCompleted ? '/shopper/completed' : '/shopper/visits'

  const handleSubmit = async (event) => {
    event.preventDefault()

    const missing = evaluationCriteria.some(
      (criterion) => Number(scores[criterion.key] ?? 0) < 1,
    )

    if (missing) {
      setError('يرجى تقييم جميع المعايير قبل إرسال التقييم.')
      return
    }

    await completeVisit(visit.id, {
      scores: {
        ...scores,
        __notes: criteriaNotes,
      },
      notes,
    })

    navigate('/shopper/completed', { replace: true })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">{visit.officeName}</h2>
            <p className="mt-1 text-sm text-slate-500">{visit.type} • {visit.city}</p>
          </div>

          <StatusBadge status={visit.status} />

          {SHOW_POINTS_SECTION && isCompleted && (
            <PointsBadge points={visit.pointsEarned ?? 0} className="ms-auto" />
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">التاريخ والفترة</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {visit.date} • {visit.time}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">المعرف الداخلي</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{visit.id}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-800">وصف السيناريو</p>
          <p className="mt-2 text-sm text-slate-600">{visit.scenario}</p>
        </div>
        {visit.fileUrls && visit.fileUrls.length > 0 && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <p className="text-sm font-black text-slate-800">مرفقات الزيارة الصوتية</p>
            <div className="mt-2 space-y-2">
              {visit.fileUrls.map((url, idx) => {
                const isGoogleDrive = String(url).includes('drive.google.com')
                const ext = String(url).split('.').pop()?.toLowerCase() || ''
                const isDirectAudio = ['mp3', 'wav', 'm4a', 'webm', 'aac'].includes(ext)

                return (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                    {isGoogleDrive ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">ملف صوتي {idx + 1}</p>
                          <p className="text-xs text-slate-500">محفوظ في Google Drive</p>
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          فتح الملف
                        </a>
                      </div>
                    ) : isDirectAudio ? (
                      <audio controls className="w-full">
                        <source src={url} />
                        متصفحك لا يدعم تشغيل الصوت
                      </audio>
                    ) : (
                      <a href={url} target="_blank" rel="noreferrer" className="text-sm font-bold text-indigo-600 hover:underline">
                        افتح المرفق
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl font-black text-slate-900">نموذج التقييم</h3>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${getScoreClasses(
              finalScore,
            )}`}
          >
            {finalScore.toFixed(2)} / 5
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {evaluationCriteria.map((criterion) => (
            <div key={criterion.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-slate-900">{criterion.label}</p>
                  <p className="text-xs text-slate-500">الوزن النسبي: {criterion.weight * 100}%</p>
                </div>
                <StarRating
                  value={scores[criterion.key] ?? 0}
                  onChange={(value) =>
                    setScores((previous) => ({
                      ...previous,
                      [criterion.key]: value,
                    }))
                  }
                  readOnly={isCompleted}
                  showValue
                />
              </div>

              <div className="mt-3">
                <label className="mb-2 block text-xs font-bold text-slate-600">
                  ملاحظات هذا المعيار
                </label>
                <textarea
                  value={criteriaNotes[criterion.key] ?? ''}
                  onChange={(event) =>
                    setCriteriaNotes((previous) => ({
                      ...previous,
                      [criterion.key]: event.target.value,
                    }))
                  }
                  rows={3}
                  readOnly={isCompleted}
                  placeholder="اكتب ما لاحظته في هذا المعيار..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          ))}

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700">الملاحظات</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              readOnly={isCompleted}
              placeholder="اكتب ملاحظاتك التفصيلية حول الزيارة..."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!isCompleted && (
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                <Save className="h-4 w-4" />
                إرسال واعتماد التقييم
              </button>
            )}

            <Link
              to={backPath}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              العودة
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
