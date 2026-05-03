'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrderItem } from '@/types'

interface Order {
  id: string
  table_number: string
  status: string
  total: number
  items: OrderItem[]
  notes: string
  guest_count: number
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  submitted:  { label: 'جديد',           color: 'bg-[#3d2e0a] text-[#f39c12]', next: 'preparing', nextLabel: 'ابدأ التحضير 👨‍🍳' },
  preparing:  { label: 'جارٍ التحضير',   color: 'bg-[#0a2030] text-[#3498db]', next: 'ready',     nextLabel: 'جاهز ✅' },
  ready:      { label: 'جاهز',           color: 'bg-[#0a2010] text-[#2ecc71]', next: 'done',      nextLabel: 'تم التسليم 🎉' },
  done:       { label: 'مُسلَّم',         color: 'bg-[#2a2927] text-[#8a8884]' },
  cancelled:  { label: 'ملغي',           color: 'bg-[#3d0a0a] text-[#e74c3c]' },
}

const CANCEL_REASONS = [
  'العميل غيّر رأيه',
  'خطأ في الطلب',
  'انتهى الصنف',
  'طلب مكرر',
  'سبب آخر',
]

export default function OrdersAdminPage() {
  const [orders, setOrders]         = useState<Order[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [selected, setSelected]     = useState<Order | null>(null)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10))

  // Cancel modal state
  const [cancelTarget, setCancelTarget]   = useState<Order | null>(null)
  const [managerPass, setManagerPass]     = useState('')
  const [cancelReason, setCancelReason]   = useState(CANCEL_REASONS[0])
  const [cancelError, setCancelError]     = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  useEffect(() => {
    loadOrders()
    const ch = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadOrders)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dateFilter])

  const loadOrders = async () => {
    const start = new Date(dateFilter); start.setHours(0, 0, 0, 0)
    const end   = new Date(dateFilter); end.setHours(23, 59, 59, 999)
    const { data } = await supabase.from('orders').select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const advance = async (order: Order) => {
    const cfg = STATUS_CONFIG[order.status]
    if (!cfg.next) return
    await supabase.from('orders').update({ status: cfg.next }).eq('id', order.id)
    loadOrders()
    if (selected?.id === order.id) setSelected({ ...order, status: cfg.next })
  }

  const openCancelModal = (order: Order, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setCancelTarget(order)
    setManagerPass('')
    setCancelReason(CANCEL_REASONS[0])
    setCancelError('')
  }

  const submitCancel = async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    setCancelError('')

    // Verify manager password via API
    const res = await fetch('/api/cancel-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: cancelTarget.id,
        managerPassword: managerPass,
        reason: cancelReason,
      }),
    })

    const data = await res.json()
    setCancelLoading(false)

    if (!res.ok) {
      setCancelError(data.error || 'حدث خطأ')
      return
    }

    setCancelTarget(null)
    if (selected?.id === cancelTarget.id) setSelected(null)
    loadOrders()
  }

  const filtered = orders.filter(o => filter === 'all' || o.status === filter)
  const totals = {
    all:       orders.length,
    submitted: orders.filter(o => o.status === 'submitted').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready:     orders.filter(o => o.status === 'ready').length,
  }

  const canCancel = (status: string) => ['submitted', 'preparing'].includes(status)

  return (
    <div className="min-h-screen bg-[#111110] text-white p-4 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">🧾 الطلبات</h1>
          <p className="text-[#8a8884] text-sm mt-1">
            إجمالي اليوم: <span className="text-white font-bold">{orders.filter(o=>o.status!=='cancelled').reduce((s, o) => s + o.total, 0).toFixed(0)} ج</span>
          </p>
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="bg-[#1a1917] border border-[#3a3936] rounded-xl px-4 py-2 text-white text-sm focus:border-[#e74c3c] outline-none"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {[
          { k: 'all',       l: 'الكل' },
          { k: 'submitted', l: 'جديد' },
          { k: 'preparing', l: 'جارٍ التحضير' },
          { k: 'ready',     l: 'جاهز' },
          { k: 'done',      l: 'مُسلَّم' },
          { k: 'cancelled', l: 'ملغي' },
        ].map(t => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              filter === t.k
                ? 'bg-[#e74c3c] border-[#e74c3c] text-white'
                : 'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'
            }`}
          >
            {t.l}
            {(totals as Record<string, number>)[t.k] > 0 && (
              <span className="bg-white/20 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {(totals as Record<string, number>)[t.k]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#1a1917] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.submitted
            return (
              <div
                key={order.id}
                onClick={() => setSelected(order)}
                className="bg-[#1a1917] border border-[#2a2927] rounded-2xl p-4 cursor-pointer hover:border-[#e74c3c]/40 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-lg">طاولة {order.table_number}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    {order.guest_count > 1 && (
                      <span className="text-xs text-[#8a8884]">👥 {order.guest_count} أفراد</span>
                    )}
                  </div>
                  <span className="font-black text-[#e74c3c]">{order.total.toFixed(0)} ج</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8a8884] text-xs">
                    {(order.items || []).reduce((s, i) => s + i.qty, 0)} صنف &nbsp;·&nbsp;
                    {new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="flex gap-2">
                    {/* Cancel button */}
                    {canCancel(order.status) && (
                      <button
                        onClick={e => openCancelModal(order, e)}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#2a1515] border border-[#e74c3c]/30 text-[#e74c3c] hover:bg-[#e74c3c]/20 transition-all"
                      >
                        ❌ إلغاء
                      </button>
                    )}
                    {/* Advance button */}
                    {cfg.next && (
                      <button
                        onClick={e => { e.stopPropagation(); advance(order) }}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#e74c3c] text-white hover:bg-[#c0392b] transition-all"
                      >
                        {cfg.nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {!filtered.length && (
            <div className="text-center text-[#8a8884] py-16 text-lg">لا توجد طلبات</div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 flex items-end justify-center z-40 p-4">
          <div className="bg-[#1a1917] rounded-3xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-black">طاولة {selected.table_number}</h2>
                <p className="text-[#8a8884] text-xs">#{selected.id.slice(0, 8)} · {selected.guest_count} أفراد</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.submitted).color}`}>
                  {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.submitted).label}
                </span>
                <button onClick={() => setSelected(null)} className="text-[#8a8884] hover:text-white text-xl">✕</button>
              </div>
            </div>

            {selected.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#2a2927]">
                <div className="flex items-center gap-2">
                  <span>{item.emoji}</span>
                  <span className="font-bold">{item.name_ar}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[#8a8884]">x{item.qty}</span>
                  <span className="font-bold text-[#e74c3c]">{(item.price * item.qty).toFixed(0)} ج</span>
                </div>
              </div>
            ))}

            {selected.notes && (
              <p className="mt-3 text-sm text-[#8a8884] bg-[#111110] rounded-xl p-3">📝 {selected.notes}</p>
            )}

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#2a2927]">
              <span className="text-[#8a8884]">الإجمالي</span>
              <span className="font-black text-xl text-[#e74c3c]">{selected.total.toFixed(0)} ج</span>
            </div>

            <div className="flex gap-3 mt-4">
              {canCancel(selected.status) && (
                <button
                  onClick={() => { openCancelModal(selected); setSelected(null) }}
                  className="flex-1 border border-[#e74c3c]/50 text-[#e74c3c] font-black py-3.5 rounded-xl hover:bg-[#e74c3c]/10 transition-all"
                >
                  ❌ إلغاء الطلب
                </button>
              )}
              {STATUS_CONFIG[selected.status]?.next && (
                <button
                  onClick={() => { advance(selected); setSelected(null) }}
                  className="flex-1 bg-[#e74c3c] text-white font-black py-3.5 rounded-xl hover:bg-[#c0392b] transition-all"
                >
                  {STATUS_CONFIG[selected.status].nextLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== CANCEL MODAL ===== */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1917] border border-[#e74c3c]/30 rounded-3xl w-full max-w-sm p-6" dir="rtl">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🔐</div>
              <h3 className="text-xl font-black text-white">تأكيد إلغاء الطلب</h3>
              <p className="text-[#8a8884] text-sm mt-1">
                طاولة {cancelTarget.table_number} · {cancelTarget.total.toFixed(0)} ج
              </p>
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className="text-sm text-[#8a8884] mb-2 block">سبب الإلغاء</label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full bg-[#111110] border border-[#3a3936] rounded-xl px-4 py-3 text-white text-sm focus:border-[#e74c3c] outline-none"
              >
                {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Manager Password */}
            <div className="mb-4">
              <label className="text-sm text-[#8a8884] mb-2 block">باسورد المدير</label>
              <input
                type="password"
                value={managerPass}
                onChange={e => { setManagerPass(e.target.value); setCancelError('') }}
                placeholder="••••••••"
                className="w-full bg-[#111110] border border-[#3a3936] rounded-xl px-4 py-3 text-white text-sm focus:border-[#e74c3c] outline-none text-center tracking-widest"
                onKeyDown={e => e.key === 'Enter' && submitCancel()}
              />
            </div>

            {/* Error */}
            {cancelError && (
              <div className="bg-[#3d0a0a] border border-[#e74c3c]/30 rounded-xl px-4 py-3 text-[#e74c3c] text-sm text-center mb-4">
                ⚠️ {cancelError}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                className="flex-1 bg-[#2a2927] text-[#8a8884] font-bold py-3 rounded-xl hover:bg-[#3a3936] transition-all"
              >
                تراجع
              </button>
              <button
                onClick={submitCancel}
                disabled={!managerPass || cancelLoading}
                className="flex-1 bg-[#e74c3c] text-white font-black py-3 rounded-xl hover:bg-[#c0392b] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cancelLoading ? '...' : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
