import {
  Activity,
  BarChart3,
  LayoutDashboard,
  ScanSearch,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Footer from '../../components/Footer'
import Navbar from '../../components/Navbar'

const SHOW_POINTS_SECTION = import.meta.env.DEV

function getTabs(role) {
  const basePath = role === 'ops' ? '/ops' : '/admin'

  const tabs = [
    { label: 'نظرة عامة', to: `${basePath}/overview`, icon: LayoutDashboard },
    { label: 'الزيارات', to: `${basePath}/visits`, icon: ScanSearch },
    { label: 'التقارير', to: `${basePath}/reports`, icon: BarChart3 },
  ]

  if (role === 'admin' && SHOW_POINTS_SECTION) {
    tabs.push({ label: 'النقاط', to: `${basePath}/points`, icon: Activity })
  }

  return tabs
}

function getTitle(pathname, role) {
  if (pathname.includes('/visits')) return 'إدارة الزيارات'
  if (pathname.includes('/reports')) return 'التقارير والإحصائيات'
  if (pathname.includes('/points')) return 'إدارة النقاط'
  if (role === 'ops') return 'لوحة تحكم Ops'
  return 'لوحة تحكم المدير'
}

export default function AdminLayout(props) {
  const location = useLocation()
  const role = props.user?.role === 'ops' ? 'ops' : 'admin'
  const tabs = getTabs(role)
  const sideTitle = role === 'ops' ? 'أقسام Ops' : 'أقسام المدير'

  const contextValue = {
    ...props,
    getShopperById: (shopperId) =>
      props.shoppers.find((shopper) => shopper.id === shopperId),
  }

  return (
    <div className="min-h-screen bg-slate-100 py-4 md:py-6">
      <div className="mx-auto max-w-7xl px-4">
        <Navbar
          title={getTitle(location.pathname, role)}
          user={props.user}
          onLogout={props.onLogout}
          showLiveIndicator={props.isLive}
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 px-2 text-sm font-black text-slate-700">{sideTitle}</h3>
            <nav className="grid gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon

                return (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </NavLink>
                )
              })}
            </nav>
          </aside>

          <main className="space-y-4">
            <Outlet context={contextValue} />
          </main>
        </div>

        <Footer />
      </div>
    </div>
  )
}
