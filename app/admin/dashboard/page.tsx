'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Order{id:string;table_number:number;status:string;total:number;items:{name_ar:string;emoji:string;qty:number;price:number}[];created_at:string;cancel_reason?:string}

type Period = 'today'|'yesterday'|'week'|'month'

const PERIOD_LABELS:Record<Period,string> = {today:'اليوم',yesterday:'أمس',week:'آخر 7 أيام',month:'هذا الشهر'}

export default function DashboardPage(){
  const [orders,setOrders]     = useState<Order[]>([])
  const [loading,setLoading]   = useState(true)
  const [period,setPeriod]     = useState<Period>('today')
  const [currency,setCurrency] = useState<'EGP'|'USD'>('EGP')
  const [rate]                 = useState(50)
  const [liveCount,setLiveCount] = useState(0)
  const [tab,setTab]           = useState<'overview'|'orders'|'live'>('overview')

  const getFrom = useCallback((p:Period)=>{
    const now = new Date()
    if(p==='today'){    const d=new Date(now);d.setHours(0,0,0,0);return d}
    if(p==='yesterday'){const d=new Date(now);d.setDate(now.getDate()-1);d.setHours(0,0,0,0);return d}
    if(p==='week'){     const d=new Date(now);d.setDate(now.getDate()-7);return d}
    const d=new Date(now);d.setDate(1);d.setHours(0,0,0,0);return d
  },[])

  const load = useCallback(async(p:Period)=>{
    setLoading(true)
    const from = getFrom(p)
    const{data}=await supabase.from('orders').select('*').gte('created_at',from.toISOString()).neq('status','draft').order('created_at',{ascending:false})
    setOrders(data||[])
    setLoading(false)
  },[getFrom])

  useEffect(()=>{
    load(period)
    // Realtime
    const ch=supabase.channel('dashboard-live')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'},()=>{
        setLiveCount(c=>c+1); load(period)
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders'},()=>load(period))
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[period, load])

  const active    = orders.filter(o=>o.status!=='cancelled')
  const cancelled = orders.filter(o=>o.status==='cancelled')
  const pending   = orders.filter(o=>o.status==='pending')
  const ready     = orders.filter(o=>o.status==='ready')

  const totalRev  = active.reduce((s,o)=>s+(o.total||0),0)
  const avgOrder  = active.length?totalRev/active.length:0
  const tax       = totalRev*0.1/1.1

  const fmt=(n:number)=>currency==='EGP'?n.toLocaleString('ar-EG',{maximumFractionDigits:0})+' ج':'$'+(n/rate).toFixed(2)

  // Top items
  const itemMap:Record<string,{name_ar:string;emoji:string;qty:number;rev:number}>= {}
  active.forEach(o=>(o.items||[]).forEach(it=>{
    if(!itemMap[it.name_ar])itemMap[it.name_ar]={name_ar:it.name_ar,emoji:it.emoji||'🍽️',qty:0,rev:0}
    itemMap[it.name_ar].qty+=it.qty; itemMap[it.name_ar].rev+=it.price*it.qty
  }))
  const topItems=Object.values(itemMap).sort((a,b)=>b.qty-a.qty).slice(0,5)

  const statusColor:Record<string,string>={
    pending:'bg-[#1a1500] text-[#f39c12] border-[#f39c12]/20',
    preparing:'bg-[#0a1a2a] text-[#3498db] border-[#3498db]/20',
    ready:'bg-[#0a2010] text-[#2ecc71] border-[#2ecc71]/20',
    delivered:'bg-[#242321] text-[#6a6864] border-[#2c2b29]',
    cancelled:'bg-[#2a1515] text-[#e74c3c] border-[#e74c3c]/20',
  }
  const statusLabel:Record<string,string>={pending:'⏳ انتظار',preparing:'👨‍🍳 يُحضَّر',ready:'✅ جاهز',delivered:'📦 تم التسليم',cancelled:'❌ ملغي'}

  const KPI=({emoji,label,value,sub,color,onClick}:{emoji:string;label:string;value:string;sub?:string;color?:string;onClick?:()=>void})=>(
    <div onClick={onClick} className={`bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5 flex flex-col gap-2 ${onClick?'cursor-pointer hover:border-[#e67e22] transition-all':''}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{emoji}</span>
        {sub&&<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color||'bg-[#242321] text-[#6a6864]'}`}>{sub}</span>}
      </div>
      <div className="text-white font-black text-2xl tracking-tight">{value}</div>
      <div className="text-[#6a6864] text-xs font-medium">{label}</div>
    </div>
  )

  return(
    <div className="p-5 max-w-7xl mx-auto" dir="rtl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">📊 لوحة التحكم</h1>
          <p className="text-[#6a6864] text-sm mt-0.5">
            {PERIOD_LABELS[period]}
            {liveCount>0&&<span className="mr-2 text-[#2ecc71] text-xs">· 🔴 {liveCount} طلب جديد منذ الفتح</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Currency Toggle */}
          <div className="flex bg-[#1c1b19] border border-[#2c2b29] rounded-xl p-1">
            {(['EGP','USD']as const).map(c=>(
              <button key={c} onClick={()=>setCurrency(c)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currency===c?'bg-[#e67e22] text-white':'text-[#6a6864] hover:text-white'}`}>{c}</button>
            ))}
          </div>
          {/* Period */}
          <div className="flex bg-[#1c1b19] border border-[#2c2b29] rounded-xl p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p=>(
              <button key={p} onClick={()=>setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period===p?'bg-[#e67e22] text-white':'text-[#6a6864] hover:text-white'}`}>{PERIOD_LABELS[p]}</button>
            ))}
          </div>
          <button onClick={()=>load(period)} className="text-[#6a6864] hover:text-white px-3 py-2 rounded-xl bg-[#1c1b19] border border-[#2c2b29] text-sm transition-all">🔄</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-1.5 w-fit">
        {([['overview','📊 نظرة عامة'],['orders','🧾 الطلبات'],['live','🔴 مباشر']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab===k?'bg-[#e67e22] text-white':'text-[#6a6864] hover:text-white'}`}>{l}</button>
        ))}
      </div>

      {loading?(
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4"><div className="col-span-4 text-center py-20 text-[#6a6864]">⏳ جاري التحميل...</div></div>
      ):(
        <>
          {/* ── Overview Tab ── */}
          {tab==='overview'&&(
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <KPI emoji="💰" label="إجمالي الإيرادات" value={fmt(totalRev)} sub="شامل الضريبة" color="bg-[#0a2010] text-[#2ecc71]"/>
                <KPI emoji="🧾" label="صافي الإيرادات"   value={fmt(totalRev-tax)}/>
                <KPI emoji="📦" label="عدد الطلبات"       value={String(active.length)} sub={cancelled.length+' ملغي'} color="bg-[#2a1515] text-[#e74c3c]"/>
                <KPI emoji="🎯" label="متوسط الطلب"       value={fmt(avgOrder)}/>
                <KPI emoji="⏳" label="قيد الانتظار"      value={String(pending.length)} color="bg-[#1a1500] text-[#f39c12]" sub="انتظار" onClick={()=>setTab('orders')}/>
                <KPI emoji="✅" label="جاهز للتسليم"      value={String(ready.length)} color="bg-[#0a2010] text-[#2ecc71]" sub="جاهز" onClick={()=>setTab('orders')}/>
                <KPI emoji="💸" label="الضريبة 10%"       value={fmt(tax)}/>
                <KPI emoji="📊" label="إجمالي الطلبات"    value={String(orders.length)} sub={PERIOD_LABELS[period]}/>
              </div>

              {/* Top items */}
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">🏆 أكتر الأصناف مبيعاً</h3>
                {topItems.length===0
                  ?<div className="text-[#6a6864] text-sm text-center py-8">لا توجد بيانات</div>
                  :<div className="space-y-3">{topItems.map((it,i)=>(
                    <div key={it.name_ar} className="flex items-center gap-3">
                      <span className={`text-xs font-black w-5 text-center ${i===0?'text-[#f39c12]':i===1?'text-[#8a8884]':i===2?'text-[#cd7f32]':'text-[#3a3936]'}`}>{i+1}</span>
                      <span className="text-xl">{it.emoji}</span>
                      <div className="flex-1">
                        <div className="text-white text-sm font-semibold">{it.name_ar}</div>
                        <div className="text-[#6a6864] text-xs">{fmt(it.rev)}</div>
                      </div>
                      <span className={`text-xs font-black px-2.5 py-1 rounded-full ${i===0?'bg-[#f39c12]/15 text-[#f39c12]':i===1?'bg-[#8a8884]/15 text-[#8a8884]':i===2?'bg-[#cd7f32]/15 text-[#cd7f32]':'bg-[#242321] text-[#6a6864]'}`}>{it.qty} ×</span>
                    </div>
                  ))}</div>
                }
              </div>
            </>
          )}

          {/* ── Orders Tab ── */}
          {tab==='orders'&&(
            <div className="space-y-3">
              {orders.length===0
                ?<div className="text-center py-20 text-[#6a6864]">لا توجد طلبات</div>
                :orders.map(o=>(
                  <div key={o.id} className={`bg-[#1c1b19] border rounded-2xl p-4 ${statusColor[o.status]||'border-[#2c2b29]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-black">طاولة {o.table_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${statusColor[o.status]||'bg-[#242321] text-[#6a6864] border-[#2c2b29]'}`}>{statusLabel[o.status]||o.status}</span>
                        </div>
                        <div className="text-[#6a6864] text-xs">{new Date(o.created_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div>
                        {o.cancel_reason&&<div className="text-[#e74c3c] text-xs mt-1">السبب: {o.cancel_reason}</div>}
                      </div>
                      <span className="text-[#f39c12] font-black text-lg whitespace-nowrap">{fmt(o.total||0)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(o.items||[]).map((it,i)=>(
                        <span key={i} className="text-xs bg-[#242321] text-[#8a8884] px-2 py-1 rounded-lg">{it.emoji} {it.name_ar} ×{it.qty}</span>
                      ))}
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* ── Live Tab ── */}
          {tab==='live'&&(
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 bg-[#e74c3c] rounded-full animate-ping"/>
                <span className="text-white font-bold text-sm">الطلبات الحية — يتحدث تلقائياً</span>
              </div>
              <div className="space-y-3">
                {orders.filter(o=>['pending','preparing','ready'].includes(o.status)).length===0
                  ?<div className="text-center py-20"><div className="text-4xl mb-3">🎉</div><div className="text-[#6a6864]">لا توجد طلبات نشطة حالياً</div></div>
                  :orders.filter(o=>['pending','preparing','ready'].includes(o.status)).map(o=>(
                    <div key={o.id} className={`border rounded-2xl p-4 ${statusColor[o.status]}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-black">طاولة {o.table_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${statusColor[o.status]}`}>{statusLabel[o.status]}</span>
                        </div>
                        <span className="text-[#f39c12] font-black">{fmt(o.total||0)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(o.items||[]).map((it,i)=>(
                          <span key={i} className="text-xs bg-black/20 px-2 py-1 rounded-lg text-white">{it.emoji} {it.name_ar} ×{it.qty}</span>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
