import {
  Activity,
  BarChart3,
  LayoutDashboard,
  ScanSearch,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import CoBrandLockup from '../../components/CoBrandLockup'
import Footer from '../../components/Footer'
import Navbar from '../../components/Navbar'

const superAdminTabs = [
  { label: 'نظرة عامة', to: '/superadmin/overview', icon: LayoutDashboard },
  { label: 'إدارة المديرين', to: '/superadmin/managers', icon: ShieldCheck },
  { label: 'المتسوقون', to: '/superadmin/shoppers', icon: Users },
  { label: 'الزيارات', to: '/superadmin/visits', icon: ScanSearch },
  { label: 'التقارير', to: '/superadmin/reports', icon: BarChart3 },
  { label: 'النقاط', to: '/superadmin/points', icon: Activity },
]

function getTitle(pathname) {
  if (pathname.includes('/superadmin/managers')) return 'إدارة المديرين'
  if (pathname.includes('/superadmin/shoppers')) return 'إدارة المتسوقين'
  if (pathname.includes('/superadmin/visits')) return 'إدارة الزيارات'
  if (pathname.includes('/superadmin/reports')) return 'التقارير والإحصائيات'
  if (pathname.includes('/superadmin/points')) return 'إدارة النقاط'
  return 'لوحة تحكم المدير العام'
}

export default function SuperAdminLayout(props) {
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

        <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
          <aside className="co-brand-sidebar-container h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
              <CoBrandLockup variant="dark" sidebarAdaptive className="!p-2" />
            </div>
            <h3 className="mb-2 px-2 text-sm font-black text-slate-700">أقسام الإدارة العليا</h3>
            <nav className="grid gap-1">
              {superAdminTabs.map((tab) => {
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
