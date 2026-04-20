import {
  Building2,
  CalendarDays,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/DataState'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import StatusBadge from '../../components/StatusBadge'

const filters = [
  { label: 'الكل', value: 'الكل' },
  { label: 'زيارة جديدة', value: 'معلقة' },
  { label: 'إعادة الزيارة', value: 'قادمة' },
  { label: 'مكتملة', value: 'مكتملة' },
  { label: 'جاري المسح', value: 'جاري المسح' },
]

function getInitialVisit(shopperId = '') {
  return {
    officeName: '',
    city: '',
    type: '',
    status: 'معلقة',
    date: new Date().toISOString().slice(0, 10),
    time: 'صباحية',
    assignedShopperId: shopperId,
    scenario: '',
    files: [],
  }
}

export default function Visits() {
  const {
    user,
    visits,
    shoppers,
    addVisit,
    updateVisit,
    deleteVisit,
    getShopperById,
    dataLoading,
    dataError,
  } = useOutletContext()

  const [activeFilter, setActiveFilter] = useState('الكل')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingVisit, setEditingVisit] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const targetVisitId = String(searchParams.get('visitId') ?? '').trim()
  const hasTargetVisit = targetVisitId !== '' && visits.some((visit) => visit.id === targetVisitId)
  const [newVisit, setNewVisit] = useState(() =>
    getInitialVisit(''),
  )
  const canAssignShopper = user?.role === 'superadmin' || user?.role === 'ops'
  const canDeleteVisit = user?.role === 'superadmin' || user?.role === 'ops'
  const hasAssignableShoppers = canAssignShopper && shoppers.length > 0

  const summary = {
    total: visits.length,
    completed: visits.filter((visit) => visit.status === 'مكتملة').length,
    upcoming: visits.filter((visit) => visit.status === 'قادمة').length,
    pending: visits.filter((visit) => visit.status === 'معلقة').length,
    deleting: visits.filter((visit) => visit.status === 'جاري المسح').length,
  }

  const filteredVisits = useMemo(() => {
    const effectiveFilter = hasTargetVisit ? 'الكل' : activeFilter
    const effectiveQuery = hasTargetVisit ? '' : debouncedQuery

    return visits.filter((visit) => {
      const matchFilter = effectiveFilter === 'الكل' || visit.status === effectiveFilter
      const matchQuery = `${visit.officeName} ${visit.city}`
        .toLowerCase()
        .includes(effectiveQuery.toLowerCase())

      return matchFilter && matchQuery
    })
  }, [activeFilter, debouncedQuery, hasTargetVisit, visits])

  useEffect(() => {
    if (!targetVisitId) return

    const targetExistsInFiltered = filteredVisits.some((visit) => visit.id === targetVisitId)
    if (!targetExistsInFiltered) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('visitId')
      setSearchParams(nextParams, { replace: true })
      return
    }

    const card = document.getElementById(`visit-card-${targetVisitId}`)
    if (!card) return

    card.classList.add('border-indigo-300', 'ring-2', 'ring-indigo-200')
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const highlightTimer = window.setTimeout(() => {
      card.classList.remove('border-indigo-300', 'ring-2', 'ring-indigo-200')
    }, 2600)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('visitId')
    setSearchParams(nextParams, { replace: true })

    return () => {
      window.clearTimeout(highlightTimer)
      card.classList.remove('border-indigo-300', 'ring-2', 'ring-indigo-200')
    }
  }, [filteredVisits, searchParams, setSearchParams, targetVisitId])

  const handleCreateVisit = async (event) => {
    event.preventDefault()

    const assignedShopperId = canAssignShopper ? newVisit.assignedShopperId || null : null

    await addVisit({
      officeName: newVisit.officeName,
      city: newVisit.city,
      type: newVisit.type,
      date: newVisit.date,
      time: newVisit.time,
      status: newVisit.status,
      assignedShopperId,
      scenario: newVisit.scenario,
      files: newVisit.files,
    })

    setNewVisit(getInitialVisit(''))
    setIsAddModalOpen(false)
  }

  const handleDeleteVisit = async (visitId) => {
    if (!canDeleteVisit) return

    const confirmed = window.confirm('هل تريد حذف هذه الزيارة؟')
    if (confirmed) {
      const result = await deleteVisit(visitId)
      if (result === 'requested') {
        window.alert('جاري المسح')
      }
    }
  }

  const handleSaveEdit = async () => {
    if (!editingVisit) return

    await updateVisit(editingVisit.id, {
      officeName: editingVisit.officeName,
      city: editingVisit.city,
      type: editingVisit.type,
      status: editingVisit.status,
      date: editingVisit.date,
      time: editingVisit.time,
      assignedShopperId: canAssignShopper ? editingVisit.assignedShopperId || null : undefined,
      scenario: editingVisit.scenario,
    })

    setEditingVisit(null)
  }

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">إدارة الزيارات</h2>
            <p className="text-sm text-slate-500">تنسيق الزيارات الميدانية وتوزيع المهام</p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="ms-auto inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            إضافة زيارة
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">إجمالي</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">مكتملة</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{summary.completed}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-700">إعادة الزيارة</p>
            <p className="mt-1 text-2xl font-black text-amber-800">{summary.upcoming}</p>
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-100 p-3">
            <p className="text-xs text-slate-600">زيارة جديدة</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{summary.pending}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-700">طلبات مسح</p>
            <p className="mt-1 text-2xl font-black text-rose-800">{summary.deleting}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeFilter === filter.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="البحث عن فرع أو مدينة..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pe-10 ps-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredVisits.map((visit) => {
          const shopper = getShopperById(visit.assignedShopperId)

          return (
            <article
              key={visit.id}
              id={`visit-card-${visit.id}`}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <StatusBadge status={visit.status} />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteVisit(visit.id)}
                    disabled={!canDeleteVisit || (user?.role === 'ops' && visit.status === 'جاري المسح')}
                    className="rounded-lg border border-rose-300 p-1.5 text-rose-600 transition hover:bg-rose-50"
                    title={
                      user?.role === 'superadmin' && visit.status === 'جاري المسح'
                        ? 'اعتماد المسح'
                        : user?.role === 'ops'
                          ? 'طلب حذف'
                          : 'حذف'
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingVisit({ ...visit })}
                    className="rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100"
                    title="تعديل"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <a
                    href="https://www.nhc.sa"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100"
                    title="عرض خارجي"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="mt-3">
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  {visit.officeName}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{visit.type}</p>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                {visit.city} • {visit.date} • {visit.time}
              </p>

              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                {visit.scenario || 'بدون سيناريو'}
              </div>

              <div className="mt-3 text-sm">
                <span className="text-slate-500">
                  المتحري الخفي: {shopper ? shopper.name : 'في انتظار التعيين'}
                </span>
              </div>
            </article>
          )
        })}

        {filteredVisits.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            {visits.length === 0 ? (
              <>
                <CalendarDays className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold">لا توجد زيارات بعد</p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  إضافة زيارة
                </button>
              </>
            ) : (
              'لا توجد زيارات مطابقة للفلاتر الحالية.'
            )}
          </div>
        )}
      </section>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">إضافة زيارة</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVisit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-600">
                <span>المدينة</span>
                <input
                  required
                  value={newVisit.city}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      city: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>الفرع</span>
                <input
                  required
                  value={newVisit.officeName}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      officeName: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>الحالة</span>
                <select
                  value={newVisit.status}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      status: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                >
                  <option value="معلقة">زيارة جديدة</option>
                  <option value="قادمة">إعادة الزيارة</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>نوع السيناريو</span>
                <input
                  value={newVisit.type}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      type: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>التاريخ</span>
                <input
                  type="date"
                  value={newVisit.date}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      date: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>الفترة</span>
                <select
                  value={newVisit.time}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      time: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                >
                  <option value="صباحية">صباحية</option>
                  <option value="مسائية">مسائية</option>
                </select>
              </label>

              {canAssignShopper ? (
                <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
                  <span>المتحري الخفي</span>
                  <select
                    value={newVisit.assignedShopperId}
                    disabled={!hasAssignableShoppers}
                    onChange={(event) =>
                      setNewVisit((previous) => ({
                        ...previous,
                        assignedShopperId: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                  >
                    <option value="">في انتظار التعيين</option>
                    {shoppers.map((shopper) => (
                      <option key={shopper.id} value={shopper.id}>
                        {shopper.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
                <span>شرح تفصيلي عن الزيارة (إن وجد)</span>
                <textarea
                  value={newVisit.scenario}
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      scenario: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
                <span>ملف تسجيل / صوتي (اختياري)</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) =>
                    setNewVisit((previous) => ({
                      ...previous,
                      files: event.target.files ? Array.from(event.target.files) : [],
                    }))
                  }
                  className="w-full"
                />
              </label>

              <button
                type="submit"
                className="h-11 rounded-xl bg-sky-600 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
              >
                حفظ الزيارة
              </button>
            </form>
          </div>
        </div>
      )}

      {editingVisit && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">تعديل الزيارة</h3>
              <button
                type="button"
                onClick={() => setEditingVisit(null)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-600">
                <span>المدينة</span>
                <input
                  value={editingVisit.city}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      city: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>الفرع</span>
                <input
                  value={editingVisit.officeName}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      officeName: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>الحالة</span>
                <select
                  value={editingVisit.status}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      status: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                >
                  <option value="معلقة">زيارة جديدة</option>
                  <option value="قادمة">إعادة الزيارة</option>
                  <option value="جاري المسح">جاري المسح</option>
                </select>
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>نوع السيناريو</span>
                <input
                  value={editingVisit.type}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      type: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>التاريخ</span>
                <input
                  type="date"
                  value={editingVisit.date}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      date: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                <span>الفترة</span>
                <select
                  value={editingVisit.time}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      time: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                >
                  <option value="صباحية">صباحية</option>
                  <option value="مسائية">مسائية</option>
                </select>
              </label>

              {canAssignShopper ? (
                <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
                  <span>المتحري الخفي</span>
                  <select
                    value={editingVisit.assignedShopperId ?? ''}
                    onChange={(event) =>
                      setEditingVisit((previous) => ({
                        ...previous,
                        assignedShopperId: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-indigo-500"
                  >
                    <option value="">في انتظار التعيين</option>
                    {shoppers.map((shopper) => (
                      <option key={shopper.id} value={shopper.id}>
                        {shopper.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  المتحري الخفي: {getShopperById(editingVisit.assignedShopperId)?.name ?? 'في انتظار التعيين'}
                </div>
              )}

              <label className="space-y-1 text-sm text-slate-600 sm:col-span-2">
                <span>شرح تفصيلي عن الزيارة (إن وجد)</span>
                <textarea
                  value={editingVisit.scenario}
                  onChange={(event) =>
                    setEditingVisit((previous) => ({
                      ...previous,
                      scenario: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 outline-none focus:border-indigo-500"
                />
              </label>

              <button
                type="button"
                onClick={handleSaveEdit}
                className="h-11 rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700 sm:col-span-2"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
