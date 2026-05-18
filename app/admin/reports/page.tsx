'use client'
import { useEffect, useState } from 'react'

interface Summary {
  totalOrders:number;cancelledOrders:number;totalRevenue:number
  netRevenue:number;totalTax:number;avgOrderValue:number;totalItemsSold:number
}
interface ItemStat{name_ar:string;emoji:string;qty:number;revenue:number}
interface HourStat{hour:string;count:number;total:number}
interface DayStat{date:string;count:number;total:number}
interface TableStat{table:string;orders:number;total:number}
interface CancelReason{reason:string;count:number}
interface CancelledItem{name_ar:string;qty:number;reason:string}
interface ReportData{
  range:string;from:string;to:string;summary:Summary
  topItems:ItemStat[];bottomItems:ItemStat[]
  cancelledItems:CancelledItem[];cancelReasons:CancelReason[]
  hourlyBreakdown:HourStat[];dailyBreakdown:DayStat[]
  peakHour:{hour:string;count:number};tableBreakdown:TableStat[]
}

const QUICK = [
  {key:'today',     label:'اليوم'},
  {key:'yesterday', label:'أمس'},
  {key:'week',      label:'آخر 7 أيام'},
  {key:'month',     label:'هذا الشهر'},
  {key:'last_month',label:'الشهر الماضي'},
  {key:'custom',    label:'تاريخ مخصص'},
]

const today = () => new Date().toISOString().slice(0,10)

export default function ReportsPage(){
  const [data,setData]       = useState<ReportData|null>(null)
  const [range,setRange]     = useState('today')
  const [from,setFrom]       = useState(today())
  const [to,setTo]           = useState(today())
  const [loading,setLoading] = useState(true)
  const [tab,setTab]         = useState<'sales'|'items'|'cancels'|'tables'>('sales')
  const [fromTime,setFromTime] = useState('00:00')
  const [toTime,setToTime]     = useState('23:59')

  useEffect(()=>{load()},[range,from,to,fromTime,toTime])

  const load = async()=>{
    setLoading(true)
    try{
      const url = range==='custom'
        ? `/api/reports?from=${from}&to=${to}&fromTime=${fromTime}&toTime=${toTime}`
        : `/api/reports?range=${range}`
      const res = await fetch(url)
      const d   = await res.json()
      setData(d)
    }catch{}
    setLoading(false)
  }

  const fmt = (n:number) => n.toLocaleString('ar-EG',{minimumFractionDigits:0,maximumFractionDigits:0})+' ج'

  const KPI = ({emoji,label,value,sub,color,big}:{emoji:string;label:string;value:string;sub?:string;color?:string;big?:boolean})=>(
    <div className={`bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5 flex flex-col gap-2 ${big?'sm:col-span-2':''}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{emoji}</span>
        {sub&&<span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color||'bg-[#2a2927] text-[#8a8884]'}`}>{sub}</span>}
      </div>
      <div className="text-white font-black text-2xl tracking-tight">{value}</div>
      <div className="text-[#6a6864] text-xs font-medium">{label}</div>
    </div>
  )

  const Bar = ({value,max,color='bg-[#e67e22]'}:{value:number;max:number;color?:string})=>(
    <div className="flex-1 bg-[#242321] rounded-full h-5 overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500 flex items-center px-2`}
        style={{width:Math.max(3,Math.round(value/Math.max(max,1)*100))+'%'}}>
      </div>
    </div>
  )

  const maxHour  = data?Math.max(...data.hourlyBreakdown.map(h=>h.count),1):1
  const maxDay   = data?Math.max(...data.dailyBreakdown.map(d=>d.total),1):1
  const maxTable = data?Math.max(...data.tableBreakdown.map(t=>t.total),1):1

  const periodLabel = ()=>{
    if(range==='custom') return `${from} ${fromTime} → ${to} ${toTime}`
    return QUICK.find(q=>q.key===range)?.label||''
  }

  return(
    <div className="p-5 max-w-7xl mx-auto" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">📊 التقارير والتحليلات</h1>
          <p className="text-[#6a6864] text-sm mt-0.5">الفترة: <span className="text-[#e67e22] font-bold">{periodLabel()}</span></p>
        </div>
        <button onClick={load} className="self-start sm:self-auto text-[#8a8884] hover:text-white text-sm px-4 py-2.5 rounded-xl bg-[#1c1b19] border border-[#2c2b29] hover:border-[#3a3936] transition-all flex items-center gap-2">
          <span>🔄</span><span>تحديث</span>
        </button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK.map(q=>(
            <button key={q.key} onClick={()=>setRange(q.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${range===q.key?'bg-[#e67e22] border-[#e67e22] text-white':'bg-[#242321] border-[#2c2b29] text-[#8a8884] hover:text-white hover:border-[#3a3936]'}`}>
              {q.label}
            </button>
          ))}
        </div>
        {range==='custom'&&(
          <div className="mt-3 pt-3 border-t border-[#2c2b29] space-y-3">
            {/* Date Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-[#8a8884] text-xs font-bold whitespace-nowrap w-16">📅 من</label>
                <input type="date" value={from} onChange={e=>setFrom(e.target.value)} max={to}
                  className="flex-1 bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none [color-scheme:dark]"/>
              </div>
              <div className="flex items-center gap-3 flex-1">
                <label className="text-[#8a8884] text-xs font-bold whitespace-nowrap w-16">📅 إلى</label>
                <input type="date" value={to} onChange={e=>setTo(e.target.value)} min={from} max={today()}
                  className="flex-1 bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none [color-scheme:dark]"/>
              </div>
            </div>
            {/* Time Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-3 flex-1">
                <label className="text-[#8a8884] text-xs font-bold whitespace-nowrap w-16">⏰ وقت البداية</label>
                <input type="time" value={fromTime} onChange={e=>setFromTime(e.target.value)}
                  className="flex-1 bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none [color-scheme:dark]"/>
              </div>
              <div className="flex items-center gap-3 flex-1">
                <label className="text-[#8a8884] text-xs font-bold whitespace-nowrap w-16">⏰ وقت النهاية</label>
                <input type="time" value={toTime} onChange={e=>setToTime(e.target.value)}
                  className="flex-1 bg-[#0f0e0d] border border-[#3a3936] rounded-xl px-4 py-2.5 text-white text-sm focus:border-[#e67e22] outline-none [color-scheme:dark]"/>
              </div>
            </div>
            {/* Quick time presets */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[#5a5957] text-xs self-center">⚡ فترات سريعة:</span>
              {[
                {l:'الفطار 6-11',f:'06:00',t:'11:00'},
                {l:'الغداء 12-16',f:'12:00',t:'16:00'},
                {l:'العشاء 18-23',f:'18:00',t:'23:00'},
                {l:'وردية كاملة',f:'00:00',t:'23:59'},
              ].map(p=>(
                <button key={p.l}
                  onClick={()=>{setFromTime(p.f);setToTime(p.t)}}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${fromTime===p.f&&toTime===p.t?'bg-[#e67e22] border-[#e67e22] text-white':'bg-[#242321] border-[#2c2b29] text-[#8a8884] hover:text-white'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading?(
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[...Array(8)].map((_,i)=><div key={i} className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5 h-28 animate-pulse"/>)}
        </div>
      ):!data?(
        <div className="text-center py-20 text-[#e74c3c]">❌ فشل تحميل البيانات</div>
      ):(
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KPI emoji="💰" label="إجمالي الإيرادات" value={fmt(data.summary.totalRevenue)} sub="شامل الضريبة" color="bg-[#0a2010] text-[#2ecc71]"/>
            <KPI emoji="🧾" label="صافي الإيرادات"   value={fmt(data.summary.netRevenue)}   sub="بعد الضريبة 10%"/>
            <KPI emoji="💸" label="قيمة الضريبة"     value={fmt(data.summary.totalTax)}/>
            <KPI emoji="🎯" label="متوسط قيمة الطلب" value={fmt(data.summary.avgOrderValue)} sub={data.summary.totalOrders+' طلب'} color="bg-[#1a1500] text-[#f39c12]"/>
            <KPI emoji="📦" label="الطلبات المكتملة"  value={String(data.summary.totalOrders)}/>
            <KPI emoji="❌" label="الطلبات الملغية"   value={String(data.summary.cancelledOrders)}
              sub={data.summary.totalOrders?Math.round(data.summary.cancelledOrders/(data.summary.totalOrders+data.summary.cancelledOrders)*100)+'%':'0%'}
              color="bg-[#2a1515] text-[#e74c3c]"/>
            <KPI emoji="🍽️" label="إجمالي الأصناف المباعة" value={String(data.summary.totalItemsSold)} sub="قطعة"/>
            <KPI emoji="🔥" label="ساعة الذروة" value={data.peakHour.hour} sub={data.peakHour.count+' طلب'} color="bg-[#2a1a05] text-[#f39c12]"/>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 mb-5 bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-1.5 w-fit">
            {([['sales','📈 المبيعات'],['items','🍽️ الأصناف'],['cancels','❌ الإلغاءات'],['tables','🪑 الطاولات']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab===k?'bg-[#e67e22] text-white shadow-lg':'text-[#6a6864] hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── Sales Tab ── */}
          {tab==='sales'&&(
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">⏰ <span>المبيعات بالساعة</span></h3>
                {data.hourlyBreakdown.length===0
                  ?<Empty/>
                  :<div className="space-y-2">{data.hourlyBreakdown.map(h=>(
                    <div key={h.hour} className="flex items-center gap-3">
                      <span className="text-[#6a6864] text-xs w-12 font-mono">{h.hour}</span>
                      <Bar value={h.count} max={maxHour}/>
                      <span className="text-white text-xs font-bold w-8 text-left">{h.count}</span>
                      <span className="text-[#f39c12] text-xs w-20 text-left">{fmt(h.total)}</span>
                    </div>
                  ))}</div>
                }
              </div>
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">📅 <span>المبيعات اليومية</span></h3>
                {data.dailyBreakdown.length===0
                  ?<Empty/>
                  :<div className="space-y-2">{data.dailyBreakdown.map(d=>(
                    <div key={d.date} className="flex items-center gap-3">
                      <span className="text-[#6a6864] text-xs w-20 font-medium">{d.date}</span>
                      <Bar value={d.total} max={maxDay} color="bg-[#2ecc71]"/>
                      <span className="text-[#2ecc71] text-xs font-bold w-24 text-left">{fmt(d.total)}</span>
                    </div>
                  ))}</div>
                }
              </div>
            </div>
          )}

          {/* ── Items Tab ── */}
          {tab==='items'&&(
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">🏆 الأكثر مبيعاً</h3>
                {data.topItems.length===0?<Empty/>:(
                  <div className="space-y-3">{data.topItems.map((it,i)=>(
                    <div key={it.name_ar} className="flex items-center gap-3">
                      <span className={`text-xs font-black w-5 text-center ${i===0?'text-[#f39c12]':i===1?'text-[#8a8884]':i===2?'text-[#cd7f32]':'text-[#3a3936]'}`}>{i+1}</span>
                      <span className="text-xl">{it.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-semibold truncate">{it.name_ar}</div>
                        <div className="text-[#6a6864] text-xs">{fmt(it.revenue)}</div>
                      </div>
                      <div className="text-left">
                        <div className={`text-xs font-black px-2.5 py-1 rounded-full ${i===0?'bg-[#f39c12]/15 text-[#f39c12]':i===1?'bg-[#8a8884]/15 text-[#8a8884]':i===2?'bg-[#cd7f32]/15 text-[#cd7f32]':'bg-[#2a2927] text-[#6a6864]'}`}>{it.qty} ×</div>
                      </div>
                    </div>
                  ))}</div>
                )}
              </div>
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">📉 الأقل مبيعاً</h3>
                {data.bottomItems.length===0?<Empty/>:(
                  <div className="space-y-3">{data.bottomItems.map(it=>(
                    <div key={it.name_ar} className="flex items-center gap-3">
                      <span className="text-xl">{it.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-semibold truncate">{it.name_ar}</div>
                        <div className="text-[#6a6864] text-xs">{fmt(it.revenue)}</div>
                      </div>
                      <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#2a1515] text-[#e74c3c]">{it.qty} ×</span>
                    </div>
                  ))}</div>
                )}
              </div>
            </div>
          )}

          {/* ── Cancels Tab ── */}
          {tab==='cancels'&&(
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">📋 أسباب الإلغاء</h3>
                {data.cancelReasons.length===0?<div className="text-center py-12"><div className="text-3xl mb-2">🎉</div><div className="text-[#6a6864] text-sm">لا توجد إلغاءات!</div></div>:(
                  <div className="space-y-4">{data.cancelReasons.map(r=>(
                    <div key={r.reason}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-white text-sm">{r.reason}</span>
                        <span className="text-[#e74c3c] font-black text-sm">{r.count}</span>
                      </div>
                      <Bar value={r.count} max={data.cancelReasons[0].count} color="bg-[#e74c3c]"/>
                    </div>
                  ))}</div>
                )}
              </div>
              <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">🍽️ الأصناف الملغية</h3>
                {data.cancelledItems.length===0?<div className="text-center py-12"><div className="text-3xl mb-2">✅</div><div className="text-[#6a6864] text-sm">لا توجد أصناف ملغية</div></div>:(
                  <div className="space-y-3">{data.cancelledItems.map(it=>(
                    <div key={it.name_ar} className="flex items-start gap-3 py-2 border-b border-[#242321] last:border-0">
                      <div className="flex-1">
                        <div className="text-white text-sm font-semibold">{it.name_ar}</div>
                        <div className="text-[#6a6864] text-xs mt-0.5">{it.reason}</div>
                      </div>
                      <span className="text-[#e74c3c] font-black text-sm mt-0.5">{it.qty} ×</span>
                    </div>
                  ))}</div>
                )}
              </div>
            </div>
          )}

          {/* ── Tables Tab ── */}
          {tab==='tables'&&(
            <div className="bg-[#1c1b19] border border-[#2c2b29] rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">🪑 مبيعات الطاولات</h3>
              {data.tableBreakdown.length===0?<Empty/>:(
                <div className="space-y-3">{data.tableBreakdown.map(t=>(
                  <div key={t.table} className="flex items-center gap-3">
                    <span className="text-[#6a6864] text-sm font-bold w-20">{t.table}</span>
                    <Bar value={t.total} max={maxTable} color="bg-[#3498db]"/>
                    <span className="text-white text-xs w-8 text-left">{t.orders}</span>
                    <span className="text-[#3498db] font-black text-sm w-24 text-left">{fmt(t.total)}</span>
                  </div>
                ))}</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const Empty = ()=>(
  <div className="text-center py-12">
    <div className="text-3xl mb-2">📭</div>
    <div className="text-[#6a6864] text-sm">لا توجد بيانات في هذه الفترة</div>
  </div>
)
