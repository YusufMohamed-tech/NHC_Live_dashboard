import { Building2, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/DataState'
import PointsBadge from '../../components/PointsBadge'
import StarRating from '../../components/StarRating'
import StatusBadge from '../../components/StatusBadge'
import VisitFilesUploader from '../../components/VisitFilesUploader'
import { calculateWeightedScore, getScoreClasses } from '../../utils/scoring'

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
    updateVisitFiles,
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

  const handleSaveFiles = async ({ visitId: targetVisitId, fileUrls, pointsDelta }) => {
    await updateVisitFiles({
      visitId: targetVisitId,
      fileUrls,
      pointsDelta,
    })
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

          {isCompleted && <PointsBadge points={visit.pointsEarned ?? 0} className="ms-auto" />}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">التاريخ والوقت</p>
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
      </section>

      <VisitFilesUploader visit={visit} onSaveFiles={handleSaveFiles} />

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
