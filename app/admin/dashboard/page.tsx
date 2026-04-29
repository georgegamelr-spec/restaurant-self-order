'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface KPI { todaySales: number; todayOrders: number; avgOrder: number; lowStockCount: number; topItems: {name:string;qty:number}[]; hourlyOrders: {hour:string;count:number;total:number}[] }

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KPI | null>(null)
  const [currency, setCurrency] = useState<'EGP'|'USD'>('EGP')
  const [rate] = useState(50) // 1 USD = 50 EGP

  useEffect(() => {
    loadKPIs()
    const ch = supabase.channel('dash').on('postgres_changes',{event:'*',schema:'public',table:'orders'},loadKPIs).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const loadKPIs = async () => {
    const today = new Date(); today.setHours(0,0,0,0)
    const { data: orders } = await supabase.from('orders').select('*').gte('created_at', today.toISOString()).neq('status','draft')
    const { data: ingredients } = await supabase.from('ingredients').select('id,name,stock_qty,min_stock')

    if (!orders) return
    const todaySales = orders.reduce((s,o) => s + (o.total||0), 0)
    const todayOrders = orders.length
    const avgOrder = todayOrders ? todaySales / todayOrders : 0
    const lowStockCount = ingredients?.filter(i => i.stock_qty <= i.min_stock).length || 0

    // Top items
    const itemMap: Record<string,{name:string;qty:number}> = {}
    orders.forEach(o => (o.items||[]).forEach((it:{name_ar:string;qty:number}) => {
      if (!itemMap[it.name_ar]) itemMap[it.name_ar] = { name: it.name_ar, qty: 0 }
      itemMap[it.name_ar].qty += it.qty
    }))
    const topItems = Object.values(itemMap).sort((a,b)=>b.qty-a.qty).slice(0,5)

    // Hourly
    const hourMap: Record<string,{count:number;total:number}> = {}
    orders.forEach(o => {
      const h = new Date(o.created_at).getHours().toString().padStart(2,'0') + ':00'
      if (!hourMap[h]) hourMap[h] = {count:0,total:0}
      hourMap[h].count++; hourMap[h].total += o.total||0
    })
    const hourlyOrders = Object.entries(hourMap).map(([hour,v])=>({hour,...v})).sort((a,b)=>a.hour.localeCompare(b.hour))

    setKpi({ todaySales, todayOrders, avgOrder, lowStockCount, topItems, hourlyOrders })
  }

  const fmt = (n: number) => currency === 'EGP'
    ? `${n.toFixed(0)} ج`
    : `$${(n/rate).toFixed(2)}`

  const KPICard = ({ emoji, label, value, sub, color }: {emoji:string;label:string;value:string;sub?:string;color:string}) => (
    <div className={`bg-[#1a1917] border rounded-2xl p-5 border-[#2c2b29]`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{emoji}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{sub}</span>
      </div>
      <div className="text-white font-black text-2xl mb-1">{value}</div>
      <div className="text-[#8a8884] text-xs">{label}</div>
    </div>
  )

  return (
    <div className="p-5 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">📊 الرئيسية</h1>
          <p className="text-[#8a8884] text-sm">{new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
        <div className="flex gap-2">
          {(['EGP','USD'] as const).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${currency===c ? 'bg-[#e74c3c] border-[#e74c3c] text-white' : 'bg-[#1a1917] border-[#3a3936] text-[#8a8884]'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard emoji="💰" label="مبيعات اليوم" value={fmt(kpi?.todaySales||0)} sub="اليوم" color="text-[#2ecc71] bg-[#0a2010]" />
        <KPICard emoji="🧾" label="عدد الطلبات" value={String(kpi?.todayOrders||0)} sub="طلب" color="text-[#3498db] bg-[#0a2030]" />
        <KPICard emoji="📈" label="متوسط الطلب" value={fmt(kpi?.avgOrder||0)} sub="متوسط" color="text-[#f39c12] bg-[#3d2e0a]" />
        <KPICard emoji="⚠️" label="تنبيهات المخزون" value={String(kpi?.lowStockCount||0)} sub="صنف" color="text-[#e74c3c] bg-[#3d1c18]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Items */}
        <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
          <h2 className="text-white font-black mb-4">🏆 أكثر الأصناف مبيعاً</h2>
          {kpi?.topItems.length ? kpi.topItems.map((item,i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#2c2b29] last:border-0">
              <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ${i===0?'bg-[#f39c12] text-black':i===1?'bg-[#8a8884] text-black':i===2?'bg-[#cd7f32] text-black':'bg-[#2a2927] text-[#8a8884]'}`}>{i+1}</span>
              <span className="text-[#e8e6e1] text-sm flex-1">{item.name}</span>
              <span className="text-[#f39c12] font-black text-sm">{item.qty} وحدة</span>
              <div className="w-20 bg-[#2a2927] rounded-full h-1.5">
                <div className="bg-[#e74c3c] h-1.5 rounded-full" style={{width:`${Math.min(100,(item.qty/(kpi.topItems[0]?.qty||1))*100)}%`}} />
              </div>
            </div>
          )) : <p className="text-[#5a5957] text-sm">لا توجد بيانات اليوم</p>}
        </div>

        {/* Hourly Chart */}
        <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
          <h2 className="text-white font-black mb-4">⏰ الطلبات بالساعة</h2>
          {kpi?.hourlyOrders.length ? (
            <div className="space-y-2">
              {kpi.hourlyOrders.map((h,i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[#8a8884] text-xs w-12 text-left">{h.hour}</span>
                  <div className="flex-1 bg-[#2a2927] rounded-full h-6 relative overflow-hidden">
                    <div className="bg-gradient-to-l from-[#e74c3c] to-[#e74c3c]/60 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                      style={{width:`${Math.min(100,(h.count/(Math.max(...kpi.hourlyOrders.map(x=>x.count))||1))*100)}%`}}>
                      <span className="text-white text-xs font-bold">{h.count}</span>
                    </div>
                  </div>
                  <span className="text-[#f39c12] text-xs w-16 text-left">{fmt(h.total)}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-[#5a5957] text-sm">لا توجد بيانات اليوم</p>}
        </div>
      </div>
    </div>
  )
}
