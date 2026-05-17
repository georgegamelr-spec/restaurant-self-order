'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus } from '@/types'

const STATUS_CONFIG: Record<OrderStatus, {
  label: string; color: string; bg: string; border: string
  next: OrderStatus | null; nextLabel: string; colBg: string
}> = {
  draft:     { label: 'مسودة',         color: 'text-[#8a8884]', bg: 'bg-[#2a2927]', border: 'border-[#3a3936]',      colBg: 'bg-[#141312]', next: null,        nextLabel: '' },
  submitted: { label: '🆕 طلب جديد',   color: 'text-[#f39c12]', bg: 'bg-[#3d2e0a]', border: 'border-[#f39c12]/30', colBg: 'bg-[#1a1508]', next: 'preparing', nextLabel: '👨‍🍳 بدء التحضير' },
  preparing: { label: '👨‍🍳 يتحضر',    color: 'text-[#3498db]', bg: 'bg-[#0a2030]', border: 'border-[#3498db]/30', colBg: 'bg-[#080f18]', next: 'ready',     nextLabel: '✅ جاهز' },
  ready:     { label: '✅ جاهز',        color: 'text-[#2ecc71]', bg: 'bg-[#0a2010]', border: 'border-[#2ecc71]/30', colBg: 'bg-[#061209]', next: 'done',      nextLabel: '🎉 تسليم' },
  done:      { label: '🎉 تم التسليم', color: 'text-[#5a5957]', bg: 'bg-[#1a1917]', border: 'border-[#2c2b29]',    colBg: 'bg-[#111010]', next: null,        nextLabel: '' },
  cancelled: { label: '❌ ملغي',        color: 'text-[#e74c3c]', bg: 'bg-[#3d0a0a]', border: 'border-[#e74c3c]/20', colBg: 'bg-[#180808]', next: null,        nextLabel: '' },
}

const KANBAN_COLS: OrderStatus[] = ['submitted', 'preparing', 'ready', 'done']

const ALLOWED_MOVES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  submitted: ['preparing'],
  preparing: ['submitted', 'ready'],
  ready:     ['preparing', 'done'],
}

export default function KitchenPage() {
  const [orders, setOrders]         = useState<Order[]>([])
  const [updating, setUpdating]     = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [view, setView]             = useState<'kanban' | 'list'>('kanban')
  const [dragOver, setDragOver]     = useState<OrderStatus | null>(null)
  const dragId = useRef<string | null>(null)

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) { setOrders(data); setLastUpdated(new Date()) }
  }

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('orders-kitchen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
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

  const onDragStart = (e: React.DragEvent, orderId: string) => {
    dragId.current = orderId
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e: React.DragEvent, col: OrderStatus) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(col)
  }
  const onDrop = async (e: React.DragEvent, targetStatus: OrderStatus) => {
    e.preventDefault()
    setDragOver(null)
    if (!dragId.current) return
    const order = orders.find(o => o.id === dragId.current)
    if (!order || order.status === targetStatus) return
    const allowed = ALLOWED_MOVES[order.status] ?? []
    if (allowed.includes(targetStatus)) {
      await updateStatus(dragId.current, targetStatus)
    }
    dragId.current = null
  }

  const formatTime = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `${mins} د`
    return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  }

  const activeCount = orders.filter(o => ['submitted', 'preparing', 'ready'].includes(o.status)).length

  const OrderCard = ({ order }: { order: Order }) => {
    const cfg = STATUS_CONFIG[order.status]
    const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
    const isUrgent = elapsed > 15 && !['done', 'cancelled'].includes(order.status)
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, order.id)}
        onDragEnd={() => setDragOver(null)}
        className={[
          cfg.bg, 'border', cfg.border,
          'rounded-2xl p-3.5 cursor-grab active:cursor-grabbing transition-all select-none',
          isUrgent ? 'shadow-[0_0_20px_rgba(231,76,60,0.25)]' : '',
          updating === order.id ? 'opacity-50' : 'hover:scale-[1.01] hover:shadow-lg',
        ].join(' ')}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-base">طاولة {order.table_number}</span>
            {isUrgent && (
              <span className="text-[#e74c3c] text-[10px] font-black bg-[#3d1c18] px-1.5 py-0.5 rounded-full animate-pulse">
                ⚠️ {elapsed}د
              </span>
            )}
          </div>
          <span className="text-[#5a5957] text-xs">{formatTime(order.created_at)}</span>
        </div>

        <div className="space-y-1 mb-3">
          {(order.items as Array<{ emoji: string; name_ar: string; qty: number }>).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-lg leading-none">{item.emoji}</span>
              <span className="text-[#e8e6e1] text-sm flex-1 leading-tight">{item.name_ar}</span>
              <span className="text-[#f39c12] font-black text-sm bg-black/30 px-2 py-0.5 rounded-lg">×{item.qty}</span>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="bg-black/20 rounded-xl px-2.5 py-2 mb-3 text-[#f39c12] text-xs">
            📝 {order.notes}
          </div>
        )}

        {cfg.next && (
          <button
            onClick={() => updateStatus(order.id, cfg.next!)}
            disabled={updating === order.id}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] active:scale-95 text-white font-bold py-2 rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {updating === order.id ? '⏳' : cfg.nextLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0f0e0d]" dir="rtl">
      {/* Header */}
      <div className="bg-[#1a1917] border-b border-[#2c2b29] px-5 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-black text-lg">👨‍🍳 Kitchen Display</h1>
          <div className="flex items-center gap-1.5 text-[#2ecc71] text-xs font-bold bg-[#0a2010] px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2ecc71] animate-pulse" />
            مباشر
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#5a5957] text-xs hidden sm:block">{lastUpdated.toLocaleTimeString('ar-EG')}</span>
          <span className="text-[#f39c12] font-black text-base bg-[#3d2e0a] w-8 h-8 rounded-full flex items-center justify-center">{activeCount}</span>
          <div className="flex bg-[#2a2927] rounded-xl p-0.5 gap-0.5">
            <button onClick={() => setView('kanban')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'kanban' ? 'bg-[#e74c3c] text-white' : 'text-[#8a8884]'}`}>
              ⊞ كانبان
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-[#e74c3c] text-white' : 'text-[#8a8884]'}`}>
              ≡ قائمة
            </button>
          </div>
        </div>
      </div>

      {/* ── Kanban View ── */}
      {view === 'kanban' && (
        <div className="flex gap-3 p-4 overflow-x-auto min-h-[calc(100dvh-64px)]" style={{ scrollSnapType: 'x mandatory' }}>
          {KANBAN_COLS.map(col => {
            const cfg = STATUS_CONFIG[col]
            const colOrders = orders.filter(o => o.status === col)
            const isDragTarget = dragOver === col
            return (
              <div
                key={col}
                onDragOver={e => onDragOver(e, col)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onDrop(e, col)}
                style={{ scrollSnapAlign: 'start' }}
                className={[
                  'flex-shrink-0 w-[300px] md:w-[280px] rounded-2xl p-3 transition-all',
                  cfg.colBg,
                  isDragTarget ? 'ring-2 ring-[#e74c3c] ring-offset-2 ring-offset-[#0f0e0d] scale-[1.01]' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={`font-black text-sm ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-xs font-bold ${cfg.color} bg-black/30 w-6 h-6 rounded-full flex items-center justify-center`}>
                    {colOrders.length}
                  </span>
                </div>
                {isDragTarget && (
                  <div className="border-2 border-dashed border-[#e74c3c]/50 rounded-xl h-16 flex items-center justify-center text-[#e74c3c] text-xs font-bold mb-3 animate-pulse">
                    اسقط هنا ↓
                  </div>
                )}
                <div className="space-y-2.5">
                  {colOrders.length === 0 && !isDragTarget && (
                    <div className="text-center py-8 text-[#3a3936] text-xs">لا توجد طلبات</div>
                  )}
                  {colOrders.map(order => <OrderCard key={order.id} order={order} />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── List View ── */}
      {view === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
          {orders.filter(o => ['submitted', 'preparing', 'ready'].includes(o.status)).length === 0 ? (
            <div className="col-span-3 flex flex-col items-center justify-center py-24 text-[#5a5957]">
              <div className="text-5xl mb-3">🍽️</div>
              <p className="text-sm">لا توجد طلبات نشطة</p>
            </div>
          ) : (
            orders
              .filter(o => ['submitted', 'preparing', 'ready'].includes(o.status))
              .map(order => <OrderCard key={order.id} order={order} />)
          )}
        </div>
      )}
    </div>
  )
}
