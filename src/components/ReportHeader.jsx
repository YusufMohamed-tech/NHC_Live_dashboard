import CoBrandLockup from './CoBrandLockup'

export default function ReportHeader() {
  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div>
        <p className="text-xs font-semibold text-slate-500">تقرير رسمي</p>
        <p className="text-sm font-black text-slate-700">في شراكة مع</p>
      </div>

      <CoBrandLockup variant="print" className="!p-0" />
    </div>
  )
}
