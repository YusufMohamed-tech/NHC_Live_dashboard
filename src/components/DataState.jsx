import { AlertTriangle, Inbox, LoaderCircle } from 'lucide-react'
import { createElement } from 'react'

export function LoadingState({ message = 'جاري تحميل البيانات...' }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-indigo-600" />
        <p className="mt-3 text-sm font-semibold text-slate-600">{message}</p>
      </div>
    </div>
  )
}

export function ErrorState({
  message = 'حدث خطأ في تحميل البيانات، يرجى المحاولة مجدداً',
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
      <div className="text-center">
        <AlertTriangle className="mx-auto h-7 w-7 text-rose-600" />
        <p className="mt-3 text-sm font-semibold text-rose-700">{message}</p>
      </div>
    </div>
  )
}

export function EmptyState({
  message = 'لا توجد بيانات متاحة',
  icon,
  actionLabel,
  onAction,
}) {
  const IconComponent = icon ?? Inbox

  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-center">
        {createElement(IconComponent, { className: 'mx-auto h-10 w-10 text-slate-300' })}
        <p className="mt-3 text-sm font-semibold text-slate-500">{message}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
