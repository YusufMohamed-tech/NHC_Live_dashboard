import { Pencil, Plus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../../components/DataState'
import useDebouncedValue from '../../hooks/useDebouncedValue'

const initialFormState = {
  name: '',
  email: '',
  personalEmail: '',
  password: '',
  city: '',
  status: 'نشط',
  assignedShopperIds: [],
}

const initialSuperAdminFormState = {
  name: '',
  email: '',
  personalEmail: '',
  password: '',
  city: '',
  status: 'نشط',
}

const initialOpsFormState = {
  name: '',
  email: '',
  personalEmail: '',
  password: '',
  city: '',
  status: 'نشط',
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}

function ShopperAssignments({ shoppers, selectedIds, onToggle }) {
  if (!shoppers.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
        لا يوجد متسوقون متاحون حالياً للتعيين.
      </p>
    )
  }

  return (
    <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
      {shoppers.map((shopper) => (
        <label
          key={shopper.id}
          className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <span className="font-semibold text-slate-700">{shopper.name}</span>
          <input
            type="checkbox"
            checked={selectedIds.includes(shopper.id)}
            onChange={() => onToggle(shopper.id)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
        </label>
      ))}
    </div>
  )
}

export default function ManageAdmins() {
  const {
    user,
    canManageSuperAdmins,
    canManageOpsAdmins,
    superAdmins,
    opsAdmins,
    subAdmins,
    shoppers,
    addSuperAdmin,
    updateSuperAdmin,
    deleteSuperAdmin,
    addOpsAdmin,
    updateOpsAdmin,
    deleteOpsAdmin,
    addSubAdmin,
    updateSubAdmin,
    deleteSubAdmin,
    assignSubAdminShoppers,
    dataLoading,
    dataError,
  } = useOutletContext()

  const [query, setQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [assigningAdmin, setAssigningAdmin] = useState(null)
  const [form, setForm] = useState(initialFormState)
  const [assignmentsDraft, setAssignmentsDraft] = useState([])
  const [isAddSuperAdminModalOpen, setIsAddSuperAdminModalOpen] = useState(false)
  const [editingSuperAdmin, setEditingSuperAdmin] = useState(null)
  const [superAdminForm, setSuperAdminForm] = useState(initialSuperAdminFormState)
  const [isAddOpsModalOpen, setIsAddOpsModalOpen] = useState(false)
  const [editingOpsAdmin, setEditingOpsAdmin] = useState(null)
  const [opsForm, setOpsForm] = useState(initialOpsFormState)

  const debouncedQuery = useDebouncedValue(query, 300)

  const filteredSuperAdmins = useMemo(() => {
    return superAdmins.filter((admin) => {
      const target = `${admin.name} ${admin.email} ${admin.personalEmail ?? ''} ${admin.city}`
      return target.toLowerCase().includes(debouncedQuery.toLowerCase())
    })
  }, [debouncedQuery, superAdmins])

  const filteredSubAdmins = useMemo(() => {
    return subAdmins.filter((admin) => {
      const target = `${admin.name} ${admin.email} ${admin.personalEmail ?? ''} ${admin.city}`
      return target.toLowerCase().includes(debouncedQuery.toLowerCase())
    })
  }, [debouncedQuery, subAdmins])

  const filteredOpsAdmins = useMemo(() => {
    return opsAdmins.filter((admin) => {
      const target = `${admin.name} ${admin.email} ${admin.personalEmail ?? ''} ${admin.city}`
      return target.toLowerCase().includes(debouncedQuery.toLowerCase())
    })
  }, [debouncedQuery, opsAdmins])

  const isEmailUsed = (email, excludeId = null) => {
    const normalized = normalizeEmail(email)
    if (!normalized) return false

    if (
      user?.id === 'superadmin-root' &&
      normalizeEmail(user.email) === normalized &&
      user.id !== excludeId
    ) {
      return true
    }

    return [...superAdmins, ...opsAdmins, ...subAdmins].some(
      (admin) => admin.id !== excludeId && normalizeEmail(admin.email) === normalized,
    )
  }

  const toggleAssignment = (shopperId) => {
    setForm((previous) => {
      const exists = previous.assignedShopperIds.includes(shopperId)
      const nextIds = exists
        ? previous.assignedShopperIds.filter((id) => id !== shopperId)
        : [...previous.assignedShopperIds, shopperId]

      return {
        ...previous,
        assignedShopperIds: nextIds,
      }
    })
  }

  const toggleAssigningShopper = (shopperId) => {
    setAssignmentsDraft((previous) => {
      if (previous.includes(shopperId)) {
        return previous.filter((id) => id !== shopperId)
      }

      return [...previous, shopperId]
    })
  }

  const resetForm = () => {
    setForm(initialFormState)
  }

  const resetSuperAdminForm = () => {
    setSuperAdminForm(initialSuperAdminFormState)
  }

  const resetOpsForm = () => {
    setOpsForm(initialOpsFormState)
  }

  const handleOpenAddModal = () => {
    resetForm()
    setEditingAdmin(null)
    setIsAddModalOpen(true)
  }

  const handleOpenAddSuperAdminModal = () => {
    resetSuperAdminForm()
    setEditingSuperAdmin(null)
    setIsAddSuperAdminModalOpen(true)
  }

  const handleOpenAddOpsModal = () => {
    resetOpsForm()
    setEditingOpsAdmin(null)
    setIsAddOpsModalOpen(true)
  }

  const handleOpenEditModal = (admin) => {
    setEditingAdmin(admin)
    setForm({
      name: admin.name,
      email: admin.email,
      personalEmail: admin.personalEmail ?? '',
      password: admin.password,
      city: admin.city,
      status: admin.status,
      assignedShopperIds: admin.assignedShopperIds ?? [],
    })
    setIsAddModalOpen(false)
  }

  const handleOpenEditSuperAdminModal = (admin) => {
    setEditingSuperAdmin(admin)
    setSuperAdminForm({
      name: admin.name,
      email: admin.email,
      personalEmail: admin.personalEmail ?? '',
      password: admin.password,
      city: admin.city,
      status: admin.status,
    })
    setIsAddSuperAdminModalOpen(false)
  }

  const handleOpenEditOpsModal = (admin) => {
    setEditingOpsAdmin(admin)
    setOpsForm({
      name: admin.name,
      email: admin.email,
      personalEmail: admin.personalEmail ?? '',
      password: admin.password,
      city: admin.city,
      status: admin.status,
    })
    setIsAddOpsModalOpen(false)
  }

  const handleOpenAssignModal = (admin) => {
    setAssigningAdmin(admin)
    setAssignmentsDraft(admin.assignedShopperIds ?? [])
  }

  const handleCreateSubAdmin = async (event) => {
    event.preventDefault()

    if (isEmailUsed(form.email)) {
      window.alert('البريد الإلكتروني مستخدم بالفعل.')
      return
    }

    await addSubAdmin(form)
    setIsAddModalOpen(false)
    resetForm()
  }

  const handleCreateSuperAdmin = async (event) => {
    event.preventDefault()

    if (!canManageSuperAdmins) {
      window.alert('إنشاء سوبر أدمن جديد متاح فقط للسوبر أدمن الرئيسي.')
      return
    }

    if (isEmailUsed(superAdminForm.email)) {
      window.alert('البريد الإلكتروني مستخدم بالفعل.')
      return
    }

    await addSuperAdmin(superAdminForm)
    setIsAddSuperAdminModalOpen(false)
    resetSuperAdminForm()
  }

  const handleCreateOpsAdmin = async (event) => {
    event.preventDefault()

    if (!canManageOpsAdmins) {
      window.alert('إنشاء حساب Ops متاح فقط للسوبر أدمن.')
      return
    }

    if (isEmailUsed(opsForm.email)) {
      window.alert('البريد الإلكتروني مستخدم بالفعل.')
      return
    }

    await addOpsAdmin(opsForm)
    setIsAddOpsModalOpen(false)
    resetOpsForm()
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    if (!editingAdmin) return

    if (isEmailUsed(form.email, editingAdmin.id)) {
      window.alert('البريد الإلكتروني مستخدم بالفعل.')
      return
    }

    await updateSubAdmin(editingAdmin.id, form)
    setEditingAdmin(null)
    resetForm()
  }

  const handleSaveSuperAdminEdit = async (event) => {
    event.preventDefault()
    if (!editingSuperAdmin || !canManageSuperAdmins) return

    if (isEmailUsed(superAdminForm.email, editingSuperAdmin.id)) {
      window.alert('البريد الإلكتروني مستخدم بالفعل.')
      return
    }

    await updateSuperAdmin(editingSuperAdmin.id, superAdminForm)
    setEditingSuperAdmin(null)
    resetSuperAdminForm()
  }

  const handleSaveOpsEdit = async (event) => {
    event.preventDefault()
    if (!editingOpsAdmin || !canManageOpsAdmins) return

    if (isEmailUsed(opsForm.email, editingOpsAdmin.id)) {
      window.alert('البريد الإلكتروني مستخدم بالفعل.')
      return
    }

    await updateOpsAdmin(editingOpsAdmin.id, opsForm)
    setEditingOpsAdmin(null)
    resetOpsForm()
  }

  const handleDeleteAdmin = async (adminId) => {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المدير؟')
    if (!confirmed) return

    await deleteSubAdmin(adminId)
  }

  const handleDeleteSuperAdmin = async (adminId) => {
    if (!canManageSuperAdmins) return

    const target = superAdmins.find((admin) => admin.id === adminId)
    if (!target) return

    const confirmed = window.confirm(`هل أنت متأكد من حذف السوبر أدمن ${target.name}؟`)
    if (!confirmed) return

    await deleteSuperAdmin(adminId)
  }

  const handleDeleteOpsAdmin = async (adminId) => {
    if (!canManageOpsAdmins) return

    const target = opsAdmins.find((admin) => admin.id === adminId)
    if (!target) return

    const confirmed = window.confirm(`هل أنت متأكد من حذف حساب Ops ${target.name}؟`)
    if (!confirmed) return

    await deleteOpsAdmin(adminId)
  }

  const handleSaveAssignments = async () => {
    if (!assigningAdmin) return

    await assignSubAdminShoppers(assigningAdmin.id, assignmentsDraft)
    setAssigningAdmin(null)
    setAssignmentsDraft([])
  }

  if (dataLoading) {
    return <LoadingState />
  }

  if (dataError) {
    return <ErrorState message={dataError} />
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-2xl font-black text-slate-900">إدارة المديرين</h2>
            <p className="text-sm text-slate-500">
              إدارة حسابات سوبر أدمن وOps والمديرين وتوزيع المتسوقين على المديرين
            </p>
          </div>

          <div className="ms-auto flex flex-wrap items-center gap-2">
            {canManageSuperAdmins && (
              <button
                type="button"
                onClick={handleOpenAddSuperAdminModal}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-900"
              >
                <ShieldCheck className="h-4 w-4" />
                إضافة سوبر أدمن
              </button>
            )}

            {canManageOpsAdmins && (
              <button
                type="button"
                onClick={handleOpenAddOpsModal}
                className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-fuchsia-800"
              >
                <ShieldCheck className="h-4 w-4" />
                إضافة حساب Ops
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              إضافة مدير
            </button>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="البحث باسم المدير أو البريد الأساسي/الشخصي..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pe-10 ps-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800">
            <ShieldCheck className="h-4 w-4" />
            حسابات سوبر أدمن
          </h3>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
            {filteredSuperAdmins.length}
          </span>
        </div>

        {filteredSuperAdmins.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShieldCheck}
              message="لا توجد حسابات سوبر أدمن إضافية بعد"
              actionLabel={canManageSuperAdmins ? 'إضافة سوبر أدمن' : undefined}
              onAction={canManageSuperAdmins ? handleOpenAddSuperAdminModal : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-start font-black">الاسم</th>
                  <th className="px-4 py-3 text-start font-black">البريد</th>
                  <th className="px-4 py-3 text-start font-black">البريد الشخصي</th>
                  <th className="px-4 py-3 text-start font-black">المدينة</th>
                  <th className="px-4 py-3 text-start font-black">الحالة</th>
                  <th className="px-4 py-3 text-start font-black">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuperAdmins.map((admin, index) => (
                  <tr
                    key={admin.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100/60`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{admin.name}</td>
                    <td className="px-4 py-3 text-slate-600">{admin.email}</td>
                    <td className="px-4 py-3 text-slate-600">{admin.personalEmail || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{admin.city}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          admin.status === 'نشط'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {admin.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canManageSuperAdmins ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSuperAdminModal(admin)}
                            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSuperAdmin(admin.id)}
                            disabled={admin.id === user?.id}
                            className="rounded-lg border border-rose-300 p-2 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">عرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-black text-slate-800">حسابات Ops</h3>
          <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-bold text-fuchsia-700">
            {filteredOpsAdmins.length}
          </span>
        </div>

        {filteredOpsAdmins.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ShieldCheck}
              message="لا توجد حسابات Ops بعد"
              actionLabel={canManageOpsAdmins ? 'إضافة حساب Ops' : undefined}
              onAction={canManageOpsAdmins ? handleOpenAddOpsModal : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-start font-black">الاسم</th>
                  <th className="px-4 py-3 text-start font-black">البريد</th>
                  <th className="px-4 py-3 text-start font-black">البريد الشخصي</th>
                  <th className="px-4 py-3 text-start font-black">المدينة</th>
                  <th className="px-4 py-3 text-start font-black">الحالة</th>
                  <th className="px-4 py-3 text-start font-black">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpsAdmins.map((admin, index) => (
                  <tr
                    key={admin.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-fuchsia-50/50`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{admin.name}</td>
                    <td className="px-4 py-3 text-slate-600">{admin.email}</td>
                    <td className="px-4 py-3 text-slate-600">{admin.personalEmail || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{admin.city}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          admin.status === 'نشط'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {admin.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canManageOpsAdmins ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditOpsModal(admin)}
                            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOpsAdmin(admin.id)}
                            className="rounded-lg border border-rose-300 p-2 text-rose-600 transition hover:bg-rose-50"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">عرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-black text-slate-800">المديرون</h3>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            {filteredSubAdmins.length}
          </span>
        </div>

        {filteredSubAdmins.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              message="لا يوجد مديرون بعد"
              actionLabel="إضافة مدير"
              onAction={handleOpenAddModal}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-start font-black">الاسم</th>
                  <th className="px-4 py-3 text-start font-black">البريد</th>
                  <th className="px-4 py-3 text-start font-black">البريد الشخصي</th>
                  <th className="px-4 py-3 text-start font-black">المدينة</th>
                  <th className="px-4 py-3 text-start font-black">المتسوقون المعينون</th>
                  <th className="px-4 py-3 text-start font-black">الحالة</th>
                  <th className="px-4 py-3 text-start font-black">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubAdmins.map((admin, index) => {
                  const assignedNames = shoppers
                    .filter((shopper) => (admin.assignedShopperIds ?? []).includes(shopper.id))
                    .map((shopper) => shopper.name)

                  return (
                    <tr
                      key={admin.id}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50/40`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-900">{admin.name}</td>
                      <td className="px-4 py-3 text-slate-600">{admin.email}</td>
                      <td className="px-4 py-3 text-slate-600">{admin.personalEmail || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{admin.city}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <p className="font-semibold text-slate-700">
                          {(admin.assignedShopperIds ?? []).length} متسوق
                        </p>
                        <p className="text-xs text-slate-500">
                          {assignedNames.slice(0, 2).join('، ') || 'بدون تعيين'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            admin.status === 'نشط'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {admin.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(admin)}
                            className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100"
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdmin(admin.id)}
                            className="rounded-lg border border-rose-300 p-2 text-rose-600 transition hover:bg-rose-50"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal(admin)}
                            className="rounded-lg border border-indigo-300 p-2 text-indigo-600 transition hover:bg-indigo-50"
                            title="إدارة التعيينات"
                          >
                            <Users className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAddSuperAdminModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">إضافة سوبر أدمن</h3>
              <button
                type="button"
                onClick={() => setIsAddSuperAdminModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSuperAdmin} className="mt-4 space-y-3">
              <input
                required
                value={superAdminForm.name}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="الاسم الكامل"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={superAdminForm.email}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={superAdminForm.personalEmail}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={superAdminForm.password}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={superAdminForm.city}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, city: event.target.value }))
                }
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">الحالة</p>
                <button
                  type="button"
                  onClick={() =>
                    setSuperAdminForm((prev) => ({
                      ...prev,
                      status: prev.status === 'نشط' ? 'غير نشط' : 'نشط',
                    }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    superAdminForm.status === 'نشط'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {superAdminForm.status}
                </button>
              </div>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-slate-800 text-sm font-bold text-white transition hover:bg-slate-900"
              >
                إضافة سوبر أدمن
              </button>
            </form>
          </div>
        </div>
      )}

      {editingSuperAdmin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">تعديل سوبر أدمن</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingSuperAdmin(null)
                  resetSuperAdminForm()
                }}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSuperAdminEdit} className="mt-4 space-y-3">
              <input
                required
                value={superAdminForm.name}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="الاسم الكامل"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={superAdminForm.email}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={superAdminForm.personalEmail}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={superAdminForm.password}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={superAdminForm.city}
                onChange={(event) =>
                  setSuperAdminForm((prev) => ({ ...prev, city: event.target.value }))
                }
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">الحالة</p>
                <button
                  type="button"
                  onClick={() =>
                    setSuperAdminForm((prev) => ({
                      ...prev,
                      status: prev.status === 'نشط' ? 'غير نشط' : 'نشط',
                    }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    superAdminForm.status === 'نشط'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {superAdminForm.status}
                </button>
              </div>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-slate-800 text-sm font-bold text-white transition hover:bg-slate-900"
              >
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddOpsModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">إضافة حساب Ops</h3>
              <button
                type="button"
                onClick={() => setIsAddOpsModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOpsAdmin} className="mt-4 space-y-3">
              <input
                required
                value={opsForm.name}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="الاسم الكامل"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={opsForm.email}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={opsForm.personalEmail}
                onChange={(event) =>
                  setOpsForm((prev) => ({ ...prev, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={opsForm.password}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={opsForm.city}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">الحالة</p>
                <button
                  type="button"
                  onClick={() =>
                    setOpsForm((prev) => ({
                      ...prev,
                      status: prev.status === 'نشط' ? 'غير نشط' : 'نشط',
                    }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    opsForm.status === 'نشط'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {opsForm.status}
                </button>
              </div>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-fuchsia-700 text-sm font-bold text-white transition hover:bg-fuchsia-800"
              >
                إضافة حساب Ops
              </button>
            </form>
          </div>
        </div>
      )}

      {editingOpsAdmin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">تعديل حساب Ops</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingOpsAdmin(null)
                  resetOpsForm()
                }}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOpsEdit} className="mt-4 space-y-3">
              <input
                required
                value={opsForm.name}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="الاسم الكامل"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={opsForm.email}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={opsForm.personalEmail}
                onChange={(event) =>
                  setOpsForm((prev) => ({ ...prev, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={opsForm.password}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={opsForm.city}
                onChange={(event) => setOpsForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">الحالة</p>
                <button
                  type="button"
                  onClick={() =>
                    setOpsForm((prev) => ({
                      ...prev,
                      status: prev.status === 'نشط' ? 'غير نشط' : 'نشط',
                    }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    opsForm.status === 'نشط'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {opsForm.status}
                </button>
              </div>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-fuchsia-700 text-sm font-bold text-white transition hover:bg-fuchsia-800"
              >
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">إضافة مدير</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubAdmin} className="mt-4 space-y-3">
              <input
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="الاسم الكامل"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={form.personalEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">الحالة</p>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: prev.status === 'نشط' ? 'غير نشط' : 'نشط',
                    }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    form.status === 'نشط'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {form.status}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">تعيين المتسوقين</p>
                <ShopperAssignments
                  shoppers={shoppers}
                  selectedIds={form.assignedShopperIds}
                  onToggle={toggleAssignment}
                />
              </div>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                إضافة مدير
              </button>
            </form>
          </div>
        </div>
      )}

      {editingAdmin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">حفظ التعديلات</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingAdmin(null)
                  resetForm()
                }}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3">
              <input
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="الاسم الكامل"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={form.personalEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-700">الحالة</p>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      status: prev.status === 'نشط' ? 'غير نشط' : 'نشط',
                    }))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    form.status === 'نشط'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {form.status}
                </button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">تعيين المتسوقين</p>
                <ShopperAssignments
                  shoppers={shoppers}
                  selectedIds={form.assignedShopperIds}
                  onToggle={toggleAssignment}
                />
              </div>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700"
              >
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}

      {assigningAdmin && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">حفظ التعيينات</h3>
              <button
                type="button"
                onClick={() => {
                  setAssigningAdmin(null)
                  setAssignmentsDraft([])
                }}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              المدير: <span className="font-bold">{assigningAdmin.name}</span>
            </p>

            <div className="mt-3">
              <ShopperAssignments
                shoppers={shoppers}
                selectedIds={assignmentsDraft}
                onToggle={toggleAssigningShopper}
              />
            </div>

            <button
              type="button"
              onClick={handleSaveAssignments}
              className="mt-4 h-11 w-full rounded-xl bg-indigo-600 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              حفظ التعيينات
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
