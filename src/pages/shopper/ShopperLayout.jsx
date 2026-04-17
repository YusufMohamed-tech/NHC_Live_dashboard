import { BellRing, Bot, FileBarChart2, LayoutDashboard, ScanSearch, SquareCheckBig } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Footer from '../../components/Footer'
import Navbar from '../../components/Navbar'

function getShopperTabs(unreadNotificationsCount = 0) {
  return [
    { label: 'لوحة التحكم', to: '/shopper/dashboard', icon: LayoutDashboard },
    { label: 'الزيارات', to: '/shopper/visits', icon: ScanSearch },
    { label: 'الزيارات المكتملة', to: '/shopper/completed', icon: SquareCheckBig },
    { label: 'مساعد الزيارات', to: '/shopper/assistant', icon: Bot },
    {
      label: 'الإشعارات',
      to: '/shopper/notifications',
      icon: BellRing,
      badge: unreadNotificationsCount,
    },
    { label: 'التقارير', to: '/shopper/reports', icon: FileBarChart2 },
  ]
}

function getTitle(pathname) {
  if (pathname === '/shopper/dashboard') return 'لوحة تحكم المتسوق'
  if (pathname.includes('/shopper/visits/') && pathname.split('/').length > 3)
    return 'تفاصيل الزيارة'
  if (pathname.includes('/shopper/completed/') && pathname.split('/').length > 3)
    return 'تفاصيل الزيارة المكتملة'
  if (pathname.includes('/shopper/visits')) return 'الزيارات المخصصة'
  if (pathname.includes('/shopper/completed')) return 'الزيارات المكتملة'
  if (pathname.includes('/shopper/assistant')) return 'مساعد الزيارات'
  if (pathname.includes('/shopper/notifications')) return 'مركز الإشعارات'
  if (pathname.includes('/shopper/reports')) return 'التقارير'
  return 'لوحة تحكم المتسوق'
}

export default function ShopperLayout(props) {
  const location = useLocation()
  const unreadNotificationsCount = Number(props.unreadNotificationsCount ?? 0)
  const shopperTabs = getShopperTabs(unreadNotificationsCount)
  const linkedShopperIds =
    props.user?.linkedShopperIds?.length > 0
      ? props.user.linkedShopperIds
      : [props.user?.id]

  const myVisits = props.visits.filter(
    (visit) => linkedShopperIds.includes(visit.assignedShopperId),
  )

  return (
    <div className="min-h-screen bg-slate-100 py-4 md:py-6">
      <div className="mx-auto max-w-7xl px-4">
        <Navbar title={getTitle(location.pathname)} user={props.user} onLogout={props.onLogout} />

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {shopperTabs.map((tab) => {
              const Icon = tab.icon
              const isRootTab = tab.to === '/shopper/dashboard'
              const isActive = isRootTab
                ? location.pathname === '/shopper/dashboard'
                : location.pathname.startsWith(tab.to)

              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {Number(tab.badge ?? 0) > 0 && (
                    <span className="inline-flex min-w-6 justify-center rounded-full bg-rose-100 px-1.5 py-0.5 text-xs font-black text-rose-700">
                      {tab.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        </section>

        <main className="mt-4 space-y-4">
          <Outlet
            context={{
              ...props,
              myVisits,
            }}
          />
        </main>

        <Footer />
      </div>
    </div>
  )
}
