import {
  Activity,
  BarChart3,
  LayoutDashboard,
  ScanSearch,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Footer from '../../components/Footer'
import Navbar from '../../components/Navbar'

const adminTabs = [
  { label: 'نظرة عامة', to: '/admin/overview', icon: LayoutDashboard },
  { label: 'المتسوقون', to: '/admin/shoppers', icon: Users },
  { label: 'الزيارات', to: '/admin/visits', icon: ScanSearch },
  { label: 'التقارير', to: '/admin/reports', icon: BarChart3 },
  { label: 'النقاط', to: '/admin/points', icon: Activity },
]

function getTitle(pathname) {
  if (pathname.includes('/admin/shoppers')) return 'إدارة المتسوقين'
  if (pathname.includes('/admin/visits')) return 'إدارة الزيارات'
  if (pathname.includes('/admin/reports')) return 'التقارير والإحصائيات'
  if (pathname.includes('/admin/points')) return 'إدارة النقاط'
  return 'لوحة تحكم المدير الفرعي'
}

export default function AdminLayout(props) {
  const location = useLocation()

  const contextValue = {
    ...props,
    getShopperById: (shopperId) =>
      props.shoppers.find((shopper) => shopper.id === shopperId),
  }

  return (
    <div className="min-h-screen bg-slate-100 py-4 md:py-6">
      <div className="mx-auto max-w-7xl px-4">
        <Navbar
          title={getTitle(location.pathname)}
          user={props.user}
          onLogout={props.onLogout}
          showLiveIndicator={props.isLive}
        />

        <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 px-2 text-sm font-black text-slate-700">أقسام المدير الفرعي</h3>
            <nav className="grid gap-1">
              {adminTabs.map((tab) => {
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
