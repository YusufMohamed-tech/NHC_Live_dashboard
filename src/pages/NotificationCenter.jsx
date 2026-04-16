import { BellRing, CheckCheck, CircleDot, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/DataState'

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'unread', label: 'غير مقروءة' },
  { key: 'read', label: 'مقروءة' },
]

const EVENT_LABELS = {
  visit_created: 'إنشاء زيارة',
  visit_assigned: 'إسناد زيارة',
  visit_delete_requested: 'طلب حذف',
  visit_updated: 'تعديل زيارة',
  visit_completed: 'إكمال زيارة',
  visit_reassigned: 'إعادة إسناد',
}

function formatDateTime(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function getVisitPath(role, visitId) {
  if (role === 'shopper') {
    return visitId ? `/shopper/visits/${visitId}` : '/shopper/visits'
  }

  if (role === 'superadmin') return '/superadmin/visits'
  if (role === 'ops') return '/ops/visits'
  return '/admin/visits'
}

export default function NotificationCenter() {
  const {
    user,
    notifications,
    notificationsEnabled,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    dataLoading,
    dataError,
  } = useOutletContext()

  const [activeFilter, setActiveFilter] = useState('all')

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'unread') {
      return notifications.filter((notification) => !notification.isRead)
    }

    if (activeFilter === 'read') {
      return notifications.filter((notification) => notification.isRead)
    }

    return notifications
  }, [activeFilter, notifications])

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  if (!notificationsEnabled) {
    return (
      <ErrorState message="مركز الإشعارات غير متاح حالياً. يرجى تشغيل أحدث ترحيل لقاعدة البيانات ثم إعادة التحميل." />
    )
  }

  const handleOpenNotification = async (notificationId, isRead) => {
    if (!isRead) {
      await markNotificationAsRead(notificationId)
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">مركز الإشعارات</h2>
            <p className="text-sm text-slate-500">تنبيهات النظام داخل الموقع مع استمرار الإرسال عبر البريد الإلكتروني</p>
          </div>

          <div className="ms-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700">
              <BellRing className="h-4 w-4" />
              غير المقروءة: {unreadNotificationsCount}
            </span>
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              disabled={unreadNotificationsCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCheck className="h-4 w-4" />
              تحديد الكل كمقروء
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeFilter === filter.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      {filteredNotifications.length === 0 ? (
        <EmptyState message="لا توجد إشعارات في هذا القسم حالياً" />
      ) : (
        <section className="grid gap-3">
          {filteredNotifications.map((notification) => {
            const visitPath = getVisitPath(user?.role, notification.visitId)
            const eventLabel = EVENT_LABELS[notification.eventType] ?? 'إشعار'

            return (
              <article
                key={notification.id}
                className={`rounded-xl border p-4 shadow-sm transition ${
                  notification.isRead
                    ? 'border-slate-200 bg-white'
                    : 'border-indigo-200 bg-indigo-50/40'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(notification.id, notification.isRead)}
                      className="text-start"
                    >
                      <h3 className="text-base font-black text-slate-900">{notification.title}</h3>
                    </button>
                    <p className="mt-1 text-sm text-slate-600">{notification.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                        {eventLabel}
                      </span>
                      <span>{formatDateTime(notification.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!notification.isRead && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-700">
                        <CircleDot className="h-3.5 w-3.5" />
                        جديد
                      </span>
                    )}

                    <Link
                      to={visitPath}
                      onClick={() => handleOpenNotification(notification.id, notification.isRead)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      عرض الزيارة
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
