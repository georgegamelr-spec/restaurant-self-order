'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrderItem } from '@/types'

interface Order { id:string; table_number:string; status:string; total:number; items:OrderItem[]; notes:string; guest_count:number; created_at:string }

const STATUS_CONFIG: Record<string,{label:string;color:string;next?:string;nextLabel?:string}> = {
  submitted: { label:'جديد',        color:'bg-[#3d2e0a] text-[#f39c12]',  next:'preparing', nextLabel:'ابدأ التحضير 👨‍🍳' },
  preparing: { label:'جارٍ التحضير', color:'bg-[#0a2030] text-[#3498db]',  next:'ready',     nextLabel:'جاهز ✅' },
  ready:     { label:'جاهز',         color:'bg-[#0a2010] text-[#2ecc71]',  next:'done',      nextLabel:'تم التسليم 🎉' },
  done:      { label:'مُسلَّم',       color:'bg-[#2a2927] text-[#8a8884]' },
}

export default function OrdersAdminPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Order|null>(null)
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().slice(0,10))

  useEffect(() => {
    loadOrders()
    const ch = supabase.channel('admin-orders')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadOrders)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [dateFilter])

  const loadOrders = async () => {
    const start = new Date(dateFilter); start.setHours(0,0,0,0)
    const end = new Date(dateFilter); end.setHours(23,59,59,999)
    const { data } = await supabase.from('orders').select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at',{ascending:false})
    setOrders(data||[])
    setLoading(false)
  }

  const advance = async (order: Order) => {
    const cfg = STATUS_CONFIG[order.status]
    if (!cfg.next) return
    await supabase.from('orders').update({ status: cfg.next }).eq('id', order.id)
    loadOrders()
    if (selected?.id === order.id) setSelected({...order, status: cfg.next})
  }

  const filtered = orders.filter(o => filter==='all' || o.status===filter)
  const totals = { all: orders.length, submitted: orders.filter(o=>o.status==='submitted').length, preparing: orders.filter(o=>o.status==='preparing').length, ready: orders.filter(o=>o.status==='ready').length }

  return (
    <div className="p-5 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">🧾 الطلبات</h1>
          <p className="text-[#8a8884] text-sm">إجمالي اليوم: {orders.reduce((s,o)=>s+o.total,0).toFixed(0)} ج</p>
        </div>
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
          className="bg-[#1a1917] border border-[#3a3936] rounded-xl px-4 py-2 text-white text-sm focus:border-[#e74c3c] outline-none" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto">
        {[{k:'all',l:'الكل'},{k:'submitted',l:'جديد'},{k:'preparing',l:'جارٍ التحضير'},{k:'ready',l:'جاهز'},{k:'done',l:'مُسلَّم'}].map(t=>(
          <button key={t.k} onClick={()=>setFilter(t.k)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${filter===t.k?'bg-[#e74c3c] border-[#e74c3c] text-white':'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'}`}>
            <span>{t.l}</span>
            {(totals as Record<string,number>)[t.k]>0 && <span className={`text-xs rounded-full w-5 h-5 flex items-center justify-center ${filter===t.k?'bg-white/20 text-white':'bg-[#2a2927] text-[#8a8884]'}`}>{(totals as Record<string,number>)[t.k]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 bg-[#1a1917] rounded-2xl animate-pulse"/>)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order=>{
            const cfg = STATUS_CONFIG[order.status]||STATUS_CONFIG.submitted
            return (
              <div key={order.id} className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-4 cursor-pointer hover:border-[#3a3936] transition-all" onClick={()=>setSelected(order)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-black">طاولة {order.table_number}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    {order.guest_count>1&&<span className="text-[#8a8884] text-xs">👥 {order.guest_count} أفراد</span>}
                  </div>
                  <span className="text-[#f39c12] font-black">{order.total.toFixed(0)} ج</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[#8a8884] text-xs flex gap-3">
                    <span>{(order.items||[]).reduce((s:{qty:number}[],i:{qty:number})=>[...s,i],[]).reduce((s,i)=>s+i.qty,0)} صنف</span>
                    <span>{new Date(order.created_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  {cfg.next&&(
                    <button onClick={e=>{e.stopPropagation();advance(order)}}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl bg-[#e74c3c] text-white hover:bg-[#c0392b] transition-all">
                      {cfg.nextLabel}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {!filtered.length&&<p className="text-[#5a5957] text-sm text-center py-12">لا توجد طلبات</p>}
        </div>
      )}

      {/* Order Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={()=>setSelected(null)} />
          <div className="relative bg-[#1a1917] border border-[#3a3936] rounded-3xl p-6 w-full max-w-md max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-black text-lg">طاولة {selected.table_number}</h2>
                <p className="text-[#8a8884] text-xs">#{selected.id.slice(0,8)} · {selected.guest_count} أفراد</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${(STATUS_CONFIG[selected.status]||STATUS_CONFIG.submitted).color}`}>
                {(STATUS_CONFIG[selected.status]||STATUS_CONFIG.submitted).label}
              </span>
            </div>
            {selected.items?.map((item,i)=>(
              <div key={i} className="flex justify-between items-center py-2.5 border-b border-[#2c2b29]">
                <div className="flex items-center gap-2">
                  <span>{item.emoji}</span><span className="text-[#e8e6e1] text-sm">{item.name_ar}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#8a8884] text-xs">x{item.qty}</span>
                  <span className="text-[#f39c12] text-sm font-bold">{(item.price*item.qty).toFixed(0)} ج</span>
                </div>
              </div>
            ))}
            {selected.notes&&<div className="mt-3 p-3 bg-[#0f0e0d] rounded-xl text-[#8a8884] text-xs">📝 {selected.notes}</div>}
            <div className="flex justify-between mt-4 pt-3 border-t border-[#3a3936]">
              <span className="text-white font-black">الإجمالي</span>
              <span className="text-[#f39c12] font-black text-lg">{selected.total.toFixed(0)} ج</span>
            </div>
            {STATUS_CONFIG[selected.status]?.next&&(
              <button onClick={()=>{advance(selected);setSelected(null)}}
                className="w-full mt-4 bg-[#e74c3c] text-white font-black py-3.5 rounded-xl hover:bg-[#c0392b] transition-all">
                {STATUS_CONFIG[selected.status].nextLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
