import { Building2, CalendarDays, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import StatusBadge from '../../components/StatusBadge'

const filterTabs = ['الكل', 'معلقة', 'قادمة']

export default function MyVisits() {
  const { myVisits, dataLoading, dataError } = useOutletContext()
  const [activeFilter, setActiveFilter] = useState('الكل')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 300)

  const workingVisits = myVisits.filter((visit) => visit.status !== 'مكتملة')

  const counts = {
    all: workingVisits.length,
    pending: workingVisits.filter((visit) => visit.status === 'معلقة').length,
    upcoming: workingVisits.filter((visit) => visit.status === 'قادمة').length,
  }

  const filteredVisits = useMemo(() => {
    return workingVisits.filter((visit) => {
      const matchesFilter = activeFilter === 'الكل' || visit.status === activeFilter
      const matchesSearch = `${visit.officeName} ${visit.city}`
        .toLowerCase()
        .includes(debouncedQuery.toLowerCase())

      return matchesFilter && matchesSearch
    })
  }, [activeFilter, debouncedQuery, workingVisits])

  const tabCount = {
    الكل: counts.all,
    معلقة: counts.pending,
    قادمة: counts.upcoming,
  }

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!myVisits.length) {
    return <EmptyState icon={CalendarDays} message="لا توجد زيارات مخصصة لك بعد" />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-2xl font-black text-slate-900">الزيارات المخصصة</h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(tab)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeFilter === tab
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab} ({tabCount[tab]})
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="البحث عن منشأة أو مدينة..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pe-10 ps-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredVisits.map((visit) => (
          <article
            key={visit.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <StatusBadge status={visit.status} />
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
              {visit.scenario}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                {visit.membershipId}
              </span>
              <Link
                to={`/shopper/visits/${visit.id}`}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
              >
                عرض التفاصيل
              </Link>
            </div>
          </article>
        ))}

        {filteredVisits.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            لا توجد زيارات مطابقة حالياً.
          </div>
        )}
      </section>
    </div>
  )
}
