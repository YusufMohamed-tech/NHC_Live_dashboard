import { Medal, Pencil, Star, Trophy } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'

const rankStyles = {
  1: 'bg-amber-200 text-amber-900 border-amber-300',
  2: 'bg-slate-200 text-slate-800 border-slate-300',
  3: 'bg-orange-200 text-orange-900 border-orange-300',
}

const LeaderboardRow = memo(function LeaderboardRow({
  shopper,
  rank,
  maxPoints,
  onEdit,
}) {
  const progress = maxPoints > 0 ? Math.round((shopper.points / maxPoints) * 100) : 0

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black ${
            rankStyles[rank] ?? 'bg-indigo-100 text-indigo-700 border-indigo-200'
          }`}
        >
          #{rank}
        </span>
        <Avatar name={shopper.name} size="sm" />
        <div>
          <p className="font-bold text-slate-900">{shopper.name}</p>
          <p className="text-sm text-slate-500">{shopper.city}</p>
        </div>
        <div className="ms-auto flex items-center gap-4">
          <p className="text-sm text-slate-600">{shopper.visits} زيارات</p>
          <p className="text-base font-black text-amber-700">{shopper.points} نقطة</p>
          <button
            type="button"
            onClick={() => onEdit(shopper)}
            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100"
            title="تعديل النقاط"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
})

export default function Points() {
  const { shoppers, visits, pointsRules, awardShopperPoints, dataLoading, dataError } =
    useOutletContext()
  const [editingShopper, setEditingShopper] = useState(null)
  const [pointsInput, setPointsInput] = useState('')
  const [pointsError, setPointsError] = useState('')

  const sortedShoppers = useMemo(
    () => [...shoppers].sort((first, second) => second.points - first.points),
    [shoppers],
  )

  const totalPoints = shoppers.reduce((sum, shopper) => sum + shopper.points, 0)
  const averagePerShopper = shoppers.length ? Math.round(totalPoints / shoppers.length) : 0
  const pointsFromVisits = visits.reduce((sum, visit) => sum + (visit.pointsEarned ?? 0), 0)
  const maxPoints = sortedShoppers[0]?.points ?? 0
  const handleEditPoints = useCallback(
    (shopper) => {
      const currentPoints = Number(shopper?.points ?? 0)
      setEditingShopper(shopper)
      setPointsInput(String(currentPoints))
      setPointsError('')
    },
    [],
  )

  const handleSavePoints = useCallback(async () => {
    if (!editingShopper) return

    const currentPoints = Number(editingShopper.points ?? 0)
    const parsed = Number(pointsInput)

    if (!Number.isFinite(parsed) || parsed < 0) {
      setPointsError('الرجاء إدخال رقم صالح أكبر من أو يساوي صفر.')
      return
    }

    const targetPoints = Math.round(parsed)
    const delta = targetPoints - currentPoints

    if (delta !== 0) {
      await awardShopperPoints(editingShopper.id, delta)
    }

    setEditingShopper(null)
    setPointsInput('')
    setPointsError('')
  }, [awardShopperPoints, editingShopper, pointsInput])

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (shoppers.length === 0) {
    return <EmptyState icon={Star} message="لا توجد نقاط بعد" />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-2xl font-black text-slate-900">إدارة النقاط</h2>
        <p className="mt-1 text-sm text-slate-500">متابعة النقاط والتحفيز والإنجازات</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs text-amber-700">إجمالي النقاط</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{totalPoints}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs text-sky-700">متوسط لكل متسوق</p>
            <p className="mt-1 text-2xl font-black text-sky-800">{averagePerShopper}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs text-emerald-700">نقاط الزيارات</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{pointsFromVisits}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-xl font-black text-slate-900">ترتيب المتسوقين حسب النقاط</h3>
        <div className="mt-4 space-y-3">
          {sortedShoppers.map((shopper, index) => {
            const rank = index + 1
            return (
              <LeaderboardRow
                key={shopper.id}
                shopper={shopper}
                rank={rank}
                maxPoints={maxPoints}
                onEdit={handleEditPoints}
              />
            )
          })}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-emerald-700">
            <Trophy className="h-4 w-4" />
            <h4 className="font-black">نقاط الزيارات الأساسية</h4>
          </div>
          <ul className="space-y-1 text-sm text-emerald-800">
            {pointsRules.visits.map((rule) => (
              <li key={rule.label}>
                {rule.label}: +{rule.points}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-rose-700">
            <Medal className="h-4 w-4" />
            <h4 className="font-black">نقاط التحديات الموثقة</h4>
          </div>
          <ul className="space-y-1 text-sm text-rose-800">
            {pointsRules.issues.map((rule) => (
              <li key={rule.label}>
                {rule.label}: +{rule.points}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sky-700">
            <Trophy className="h-4 w-4" />
            <h4 className="font-black">نقاط الجودة</h4>
          </div>
          <ul className="space-y-1 text-sm text-sky-800">
            {pointsRules.quality.map((rule) => (
              <li key={rule.label}>
                {rule.label}: +{rule.points}
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-indigo-700">
            <Medal className="h-4 w-4" />
            <h4 className="font-black">نقاط الإنجازات</h4>
          </div>
          <ul className="space-y-1 text-sm text-indigo-800">
            {pointsRules.achievements.map((rule) => (
              <li key={rule.label}>
                {rule.label}: +{rule.points}
              </li>
            ))}
          </ul>
        </article>
      </section>

      {editingShopper && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h4 className="font-display text-lg font-black text-slate-900">تعديل النقاط</h4>
            <p className="mt-1 text-sm text-slate-500">{editingShopper.name}</p>

            <label className="mt-4 block space-y-1 text-sm text-slate-600">
              <span>الرصيد الجديد</span>
              <input
                type="number"
                min="0"
                step="1"
                value={pointsInput}
                onChange={(event) => {
                  setPointsInput(event.target.value)
                  if (pointsError) setPointsError('')
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none transition focus:border-indigo-500"
              />
            </label>

            {pointsError && <p className="mt-2 text-xs font-semibold text-rose-600">{pointsError}</p>}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingShopper(null)
                  setPointsInput('')
                  setPointsError('')
                }}
                className="h-11 flex-1 rounded-xl border border-slate-300 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSavePoints}
                className="h-11 flex-1 rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
