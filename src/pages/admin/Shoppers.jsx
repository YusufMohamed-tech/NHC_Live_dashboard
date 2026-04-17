import { Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Avatar from '../../components/Avatar'
import { ErrorState, LoadingState } from '../../components/DataState'
import useDebouncedValue from '../../hooks/useDebouncedValue'

const SHOW_POINTS_SECTION = import.meta.env.DEV

const initialShopperForm = {
  name: '',
  email: '',
  personalEmail: '',
  password: '',
  city: '',
  primaryPhone: '',
  whatsappPhone: '',
  status: 'نشط',
}

export default function Shoppers() {
  const {
    shoppers,
    addShopper,
    updateShopper,
    deleteShopper,
    dataLoading,
    dataError,
  } = useOutletContext()

  const [query, setQuery] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingShopper, setEditingShopper] = useState(null)
  const [newShopper, setNewShopper] = useState(initialShopperForm)
  const [editingForm, setEditingForm] = useState(initialShopperForm)
  const debouncedQuery = useDebouncedValue(query, 300)

  const filteredShoppers = useMemo(() => {
    return shoppers.filter((shopper) => {
      const target = `${shopper.name} ${shopper.email} ${shopper.personalEmail ?? ''} ${shopper.city} ${shopper.primaryPhone ?? ''} ${shopper.whatsappPhone ?? ''}`
      return target.toLowerCase().includes(debouncedQuery.toLowerCase())
    })
  }, [debouncedQuery, shoppers])

  const summary = {
    total: shoppers.length,
    active: shoppers.filter((shopper) => shopper.status === 'نشط').length,
    inactive: shoppers.filter((shopper) => shopper.status !== 'نشط').length,
    points: shoppers.reduce((sum, shopper) => sum + Number(shopper.points ?? 0), 0),
  }

  const handleCreateShopper = async (event) => {
    event.preventDefault()
    await addShopper(newShopper)
    setNewShopper(initialShopperForm)
    setIsAddModalOpen(false)
  }

  const handleDeleteShopper = async (shopperId) => {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المتحري الخفي؟')
    if (!confirmed) return
    await deleteShopper(shopperId)
  }

  const openEditModal = (shopper) => {
    setEditingShopper(shopper)
    setEditingForm({
      name: shopper.name,
      email: shopper.email,
      personalEmail: shopper.personalEmail ?? '',
      password: shopper.password ?? '',
      city: shopper.city,
      primaryPhone: shopper.primaryPhone ?? '',
      whatsappPhone: shopper.whatsappPhone ?? '',
      status: shopper.status,
    })
  }

  const saveShopperEdit = async (event) => {
    event.preventDefault()
    if (!editingShopper) return

    await updateShopper(editingShopper.id, editingForm)
    setEditingShopper(null)
    setEditingForm(initialShopperForm)
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
            <h2 className="font-display text-2xl font-black text-slate-900">إدارة المتحريين الخفيين</h2>
            <p className="text-sm text-slate-500">إدارة حسابات المتحريين الخفيين وحالات النشاط</p>
          </div>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="ms-auto inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" />
            إضافة متحري خفي
          </button>
        </div>

        <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${SHOW_POINTS_SECTION ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">إجمالي</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">نشطون</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{summary.active}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-3">
            <p className="text-xs text-slate-600">غير نشطين</p>
            <p className="mt-1 text-2xl font-black text-slate-800">{summary.inactive}</p>
          </div>
          {SHOW_POINTS_SECTION && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-700">إجمالي النقاط الموزعة</p>
              <p className="mt-1 text-2xl font-black text-amber-800">{summary.points}</p>
            </div>
          )}
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="البحث عن متحري خفي..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pe-10 ps-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-start font-black">المتحري الخفي</th>
                <th className="px-4 py-3 text-start font-black">المدينة</th>
                <th className="px-4 py-3 text-start font-black">الزيارات</th>
                {SHOW_POINTS_SECTION && <th className="px-4 py-3 text-start font-black">النقاط</th>}
                <th className="px-4 py-3 text-start font-black">الحالة</th>
                <th className="px-4 py-3 text-start font-black">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredShoppers.map((shopper, index) => (
                <tr
                  key={shopper.id}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} transition hover:bg-indigo-50/40`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={shopper.name} size="sm" />
                      <div>
                        <p className="font-bold text-slate-900">{shopper.name}</p>
                        <p className="text-xs text-slate-500">{shopper.email}</p>
                        <p className="text-xs text-slate-500">
                          الشخصي: {shopper.personalEmail || '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          الأساسي: {shopper.primaryPhone || '-'}
                        </p>
                        <p className="text-xs text-slate-500">
                          واتساب: {shopper.whatsappPhone || '-'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{shopper.city}</td>
                  <td className="px-4 py-3 text-slate-700">{shopper.visits} من 20</td>
                  {SHOW_POINTS_SECTION && <td className="px-4 py-3 font-bold text-amber-700">{shopper.points}</td>}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                        shopper.status === 'نشط'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {shopper.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(shopper)}
                        className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-100"
                        title="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteShopper(shopper.id)}
                        className="rounded-lg border border-rose-300 p-2 text-rose-600 transition hover:bg-rose-50"
                        title="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredShoppers.length === 0 && (
                <tr>
                  <td colSpan={SHOW_POINTS_SECTION ? 6 : 5} className="px-4 py-8">
                    {shoppers.length === 0 ? (
                      <div className="text-center">
                        <UserRound className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-500">
                          لا يوجد متحريون خفيون بعد
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-700"
                        >
                          إضافة متحري خفي
                        </button>
                      </div>
                    ) : (
                      <p className="text-center text-sm text-slate-500">
                        لا توجد نتائج مطابقة لعملية البحث.
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">إضافة متحري خفي</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShopper} className="mt-4 space-y-3">
              <input
                required
                value={newShopper.name}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="اسم المتحري الخفي"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={newShopper.email}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={newShopper.personalEmail}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={newShopper.password}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={newShopper.city}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, city: event.target.value }))
                }
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={newShopper.primaryPhone}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, primaryPhone: event.target.value }))
                }
                placeholder="الرقم الأساسي"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={newShopper.whatsappPhone}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, whatsappPhone: event.target.value }))
                }
                placeholder="رقم الواتساب"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <select
                value={newShopper.status}
                onChange={(event) =>
                  setNewShopper((previous) => ({ ...previous, status: event.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-indigo-500"
              >
                <option value="نشط">نشط</option>
                <option value="غير نشط">غير نشط</option>
              </select>

              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-sky-600 text-sm font-bold text-white transition hover:bg-sky-700"
              >
                حفظ المتحري الخفي
              </button>
            </form>
          </div>
        </div>
      )}

      {editingShopper && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-slate-900">تعديل المتحري الخفي</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingShopper(null)
                  setEditingForm(initialShopperForm)
                }}
                className="rounded-lg border border-slate-300 p-1.5 text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={saveShopperEdit} className="mt-4 space-y-3">
              <input
                required
                value={editingForm.name}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, name: event.target.value }))
                }
                placeholder="اسم المتحري الخفي"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={editingForm.email}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, email: event.target.value }))
                }
                placeholder="البريد الإلكتروني"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="email"
                value={editingForm.personalEmail}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, personalEmail: event.target.value }))
                }
                placeholder="البريد الشخصي للإشعارات"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                type="password"
                value={editingForm.password}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, password: event.target.value }))
                }
                placeholder="كلمة المرور"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={editingForm.city}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, city: event.target.value }))
                }
                placeholder="المدينة"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={editingForm.primaryPhone}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, primaryPhone: event.target.value }))
                }
                placeholder="الرقم الأساسي"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />
              <input
                required
                value={editingForm.whatsappPhone}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, whatsappPhone: event.target.value }))
                }
                placeholder="رقم الواتساب"
                className="h-11 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-indigo-500"
              />

              <select
                value={editingForm.status}
                onChange={(event) =>
                  setEditingForm((previous) => ({ ...previous, status: event.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-indigo-500"
              >
                <option value="نشط">نشط</option>
                <option value="غير نشط">غير نشط</option>
              </select>

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
    </div>
  )
}
