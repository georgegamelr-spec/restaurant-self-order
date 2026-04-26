'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus } from '@/types'

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; next: OrderStatus | null; nextLabel: string }> = {
  draft:      { label: 'مسودة',      color: 'text-[#8a8884]', bg: 'bg-[#2a2927]', next: null, nextLabel: '' },
  submitted:  { label: 'طلب جديد',   color: 'text-[#f39c12]', bg: 'bg-[#3d2e0a]', next: 'preparing', nextLabel: '👨‍🍳 بدء التحضير' },
  preparing:  { label: 'جارٍ التحضير', color: 'text-[#3498db]', bg: 'bg-[#0a2030]', next: 'ready',    nextLabel: '✅ جاهز' },
  ready:      { label: 'جاهز',        color: 'text-[#2ecc71]', bg: 'bg-[#0a2010]', next: 'done',     nextLabel: '🎉 تم التسليم' },
  done:       { label: 'تم التسليم',  color: 'text-[#5a5957]', bg: 'bg-[#1a1917]', next: null, nextLabel: '' },
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<'active' | 'done'>('active')
  const [updating, setUpdating] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) { setOrders(data); setLastUpdated(new Date()) }
  }

  useEffect(() => {
    fetchOrders()
    // Realtime subscription
    const channel = supabase
      .channel('orders-kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    setUpdating(orderId)
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', status }),
    })
    await fetchOrders()
    setUpdating(null)
  }

  const activeOrders = orders.filter(o => ['submitted','preparing','ready'].includes(o.status))
  const doneOrders = orders.filter(o => o.status === 'done').slice(0, 20)
  const displayed = filter === 'active' ? activeOrders : doneOrders

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const mins = Math.floor((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `منذ ${mins} د`
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-dvh bg-[#0f0e0d]" dir="rtl">
      {/* Header */}
      <div className="bg-[#1a1917] border-b border-[#2c2b29] px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-white font-black text-xl">👨‍🍳 Kitchen Display</h1>
          <p className="text-[#5a5957] text-xs mt-0.5">آخر تحديث: {lastUpdated.toLocaleTimeString('ar-EG')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#2ecc71] text-xs font-bold bg-[#0a2010] px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71] animate-[pulse-dot_2s_infinite]" />
            مباشر
          </div>
          <div className="text-[#f39c12] font-black text-lg">{activeOrders.length}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 py-3">
        <button onClick={() => setFilter('active')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${filter==='active' ? 'bg-[#e74c3c] text-white' : 'bg-[#1a1917] border border-[#3a3936] text-[#8a8884]'}`}>
          نشط ({activeOrders.length})
        </button>
        <button onClick={() => setFilter('done')}
          className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${filter==='done' ? 'bg-[#1f1e1c] text-white border border-[#5a5957]' : 'bg-[#1a1917] border border-[#3a3936] text-[#8a8884]'}`}>
          منجز ({doneOrders.length})
        </button>
      </div>

      {/* Orders Grid */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#5a5957]">
          <div className="text-5xl mb-3">🍽️</div>
          <p className="text-sm">{filter === 'active' ? 'لا توجد طلبات نشطة' : 'لا توجد طلبات منجزة'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-6">
          {displayed.map(order => {
            const cfg = STATUS_CONFIG[order.status]
            const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
            const isUrgent = elapsed > 15 && order.status !== 'done'
            return (
              <div key={order.id}
                className={`${cfg.bg} border rounded-2xl p-4 transition-all ${isUrgent ? 'border-[#e74c3c] shadow-[0_0_20px_rgba(231,76,60,0.2)]' : 'border-[#2c2b29]'}`}>
                {/* Order Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-lg">طاولة {order.table_number}</span>
                    {isUrgent && <span className="text-[#e74c3c] text-xs font-bold bg-[#3d1c18] px-2 py-0.5 rounded-full">⚠️ متأخر</span>}
                  </div>
                  <div className="text-left">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color} bg-black/20`}>{cfg.label}</span>
                  </div>
                </div>
                <div className="text-[#5a5957] text-xs mb-3">{formatTime(order.created_at)} · #{order.id.slice(0,6)}</div>

                {/* Items */}
                <div className="space-y-1.5 mb-4">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-[#e8e6e1] text-sm flex-1">{item.name_ar}</span>
                      <span className="text-[#f39c12] font-black text-sm bg-black/30 px-2 py-0.5 rounded-lg">x{item.qty}</span>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="bg-black/20 rounded-xl p-2.5 mb-3 text-[#f39c12] text-xs">
                    📝 {order.notes}
                  </div>
                )}

                {/* Total + Action */}
                <div className="flex items-center justify-between">
                  <span className="text-[#f39c12] font-black">${order.total.toFixed(2)}</span>
                  {cfg.next && (
                    <button onClick={() => updateStatus(order.id, cfg.next!)}
                      disabled={updating === order.id}
                      className="bg-[#e74c3c] hover:bg-[#c0392b] text-white font-bold px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-60 active:scale-95">
                      {updating === order.id ? '⏳' : cfg.nextLabel}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
