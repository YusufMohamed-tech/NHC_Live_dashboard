import { Coins, ShieldCheck, UserCircle2, Users } from 'lucide-react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'

export default function Overview() {
  const navigate = useNavigate()
  const { subAdmins, shoppers, visits, dataLoading, dataError } = useOutletContext()

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  const totalPoints = shoppers.reduce((sum, shopper) => sum + Number(shopper.points ?? 0), 0)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-l from-indigo-700 via-violet-600 to-sky-500 p-6 text-white shadow-sm">
        <h2 className="font-display text-3xl font-black">نظرة عامة شاملة</h2>
        <p className="mt-2 text-sm text-white/85">
          متابعة كاملة لسوبر أدمن والمديرين والمتسوقين والزيارات على مستوى النظام
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs text-indigo-700">إجمالي المديرين</p>
          <p className="mt-1 text-2xl font-black text-indigo-800">{subAdmins.length}</p>
        </article>

        <article className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs text-sky-700">إجمالي المتسوقين</p>
          <p className="mt-1 text-2xl font-black text-sky-800">{shoppers.length}</p>
        </article>

        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700">إجمالي الزيارات</p>
          <p className="mt-1 text-2xl font-black text-emerald-800">{visits.length}</p>
        </article>

        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-700">إجمالي النقاط الموزعة</p>
          <p className="mt-1 text-2xl font-black text-amber-800">{totalPoints}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-black text-slate-900">أداء المديرين</h3>
          <Link
            to="/superadmin/managers"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            إدارة المديرين
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {subAdmins.map((subAdmin) => {
            const assignedIds = subAdmin.assignedShopperIds ?? []
            const assignedVisitsCount = visits.filter((visit) =>
              assignedIds.includes(visit.assignedShopperId),
            ).length

            return (
              <article
                key={subAdmin.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                    <UserCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{subAdmin.name}</p>
                    <p className="text-sm text-slate-500">{subAdmin.email}</p>
                  </div>

                  <span
                    className={`ms-auto rounded-full px-3 py-1 text-xs font-bold ${
                      subAdmin.status === 'نشط'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {subAdmin.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">عدد المتسوقين المعيّنين</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{assignedIds.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">زيارات متسوقيه</p>
                    <p className="mt-1 text-lg font-black text-slate-900">{assignedVisitsCount}</p>
                  </div>
                </div>
              </article>
            )
          })}

          {subAdmins.length === 0 && (
            <EmptyState
              icon={Users}
              message="لا يوجد مديرون بعد"
              actionLabel="إضافة مدير"
              onAction={() => {
                navigate('/superadmin/managers')
              }}
            />
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldCheck className="h-4 w-4" />
            <h4 className="font-black">المديرون النشطون</h4>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {subAdmins.filter((admin) => admin.status === 'نشط').length}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Coins className="h-4 w-4" />
            <h4 className="font-black">متوسط النقاط لكل متسوق</h4>
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">
            {shoppers.length ? Math.round(totalPoints / shoppers.length) : 0}
          </p>
        </article>
      </section>
    </div>
  )
}
