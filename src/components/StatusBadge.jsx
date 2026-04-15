const statusClasses = {
  مكتملة: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  قادمة: 'bg-amber-100 text-amber-700 border-amber-200',
  معلقة: 'bg-slate-200 text-slate-700 border-slate-300',
  'قيد الانتظار': 'bg-slate-200 text-slate-700 border-slate-300',
  'جاري المسح': 'bg-rose-100 text-rose-700 border-rose-200',
}

const statusLabels = {
  معلقة: 'زيارة جديدة',
  قادمة: 'إعادة الزيارة',
}

export default function StatusBadge({ status }) {
  const statusText = statusLabels[status] ?? status

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${statusClasses[status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}
    >
      {statusText}
    </span>
  )
}
