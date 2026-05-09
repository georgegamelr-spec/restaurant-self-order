'use client'
import { useEffect, useState } from 'react'

interface Summary {
  totalOrders: number; cancelledOrders: number; totalRevenue: number
  netRevenue: number; totalTax: number; avgOrderValue: number; totalItemsSold: number
}
interface ItemStat { name_ar: string; emoji: string; qty: number; revenue: number }
interface HourStat { hour: string; count: number; total: number }
interface TableStat { table: string; orders: number; total: number }
interface CancelReason { reason: string; count: number }
interface CancelledItem { name_ar: string; qty: number; reason: string }

interface ReportData {
  range: string; summary: Summary
  topItems: ItemStat[]; bottomItems: ItemStat[]
  cancelledItems: CancelledItem[]; cancelReasons: CancelReason[]
  hourlyBreakdown: HourStat[]; peakHour: { hour: string; count: number }
  tableBreakdown: TableStat[]
}

const RANGES = [
  { key: 'today', label: 'اليوم' },
  { key: 'week',  label: 'الأسبوع' },
  { key: 'month', label: 'الشهر' },
]

export default function ReportsPage() {
  const [data, setData]     = useState<ReportData | null>(null)
  const [range, setRange]   = useState('today')
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<'sales'|'items'|'cancels'|'tables'>('sales')

  useEffect(() => { load(range) }, [range])

  const load = async (r: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports?range=' + r)
      const d = await res.json()
      setData(d)
    } catch {}
    setLoading(false)
  }

  const fmt = (n: number) => n.toFixed(0) + ' ج'

  const KPI = ({ emoji, label, value, sub, color }: { emoji:string; label:string; value:string; sub?:string; color?:string }) => (
    <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{emoji}</span>
        {sub && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color||'bg-[#2a2927] text-[#8a8884]'}`}>{sub}</span>}
      </div>
      <div className="text-white font-black text-2xl">{value}</div>
      <div className="text-[#8a8884] text-xs mt-1">{label}</div>
    </div>
  )

  const maxHour = data ? Math.max(...(data.hourlyBreakdown.map(h => h.count)), 1) : 1

  return (
    <div className="p-5 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white font-black text-2xl">📊 التقارير</h1>
          <p className="text-[#8a8884] text-sm mt-0.5">تحليل المبيعات والأداء</p>
        </div>
        <div className="flex gap-2 bg-[#1a1917] border border-[#2c2b29] rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${range===r.key?'bg-[#e67e22] text-white':'text-[#8a8884] hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#8a8884]">⏳ جاري تحميل التقارير...</div>
      ) : !data ? (
        <div className="text-center py-20 text-[#e74c3c]">❌ فشل تحميل البيانات</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <KPI emoji="💰" label="إجمالي الإيرادات" value={fmt(data.summary.totalRevenue)} sub="شامل الضريبة" color="bg-[#0a2010] text-[#2ecc71]"/>
            <KPI emoji="🧾" label="صافي الإيرادات" value={fmt(data.summary.netRevenue)} sub="بعد الضريبة"/>
            <KPI emoji="📦" label="إجمالي الطلبات" value={String(data.summary.totalOrders)} sub={data.summary.cancelledOrders + ' ملغي'} color="bg-[#2a1515] text-[#e74c3c]"/>
            <KPI emoji="🎯" label="متوسط قيمة الطلب" value={fmt(data.summary.avgOrderValue)}/>
            <KPI emoji="🍽️" label="إجمالي الأصناف المباعة" value={String(data.summary.totalItemsSold)} sub="قطعة"/>
            <KPI emoji="🔥" label="ساعة الذروة" value={data.peakHour.hour} sub={data.peakHour.count + ' طلب'} color="bg-[#2a1a05] text-[#f39c12]"/>
            <KPI emoji="💸" label="قيمة الضريبة" value={fmt(data.summary.totalTax)} sub="10%"/>
            <KPI emoji="❌" label="الطلبات الملغية" value={String(data.summary.cancelledOrders)} sub={data.summary.totalOrders ? Math.round(data.summary.cancelledOrders/data.summary.totalOrders*100)+'%' : '0%'} color="bg-[#2a1515] text-[#e74c3c]"/>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-5 border-b border-[#2c2b29] pb-3">
            {([['sales','📈 المبيعات'],['items','🍽️ الأصناف'],['cancels','❌ الإلغاءات'],['tables','🪑 الطاولات']] as const).map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab===k?'bg-[#e67e22] text-white':'text-[#8a8884] hover:text-white'}`}>{l}</button>
            ))}
          </div>

          {/* Sales Tab */}
          {tab==='sales' && (
            <div className="space-y-4">
              <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">⏰ المبيعات بالساعة</h3>
                {data.hourlyBreakdown.length === 0 ? (
                  <div className="text-[#8a8884] text-sm text-center py-8">لا توجد بيانات</div>
                ) : (
                  <div className="space-y-2">
                    {data.hourlyBreakdown.map(h => (
                      <div key={h.hour} className="flex items-center gap-3">
                        <span className="text-[#8a8884] text-xs w-12 text-left">{h.hour}</span>
                        <div className="flex-1 bg-[#2a2927] rounded-full h-6 overflow-hidden">
                          <div className="h-full bg-[#e67e22] rounded-full flex items-center px-2 transition-all"
                            style={{width: Math.max(4, Math.round(h.count/maxHour*100))+'%'}}>
                            <span className="text-white text-xs font-bold whitespace-nowrap">{h.count} طلب</span>
                          </div>
                        </div>
                        <span className="text-[#f39c12] text-xs font-bold w-20 text-left">{fmt(h.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items Tab */}
          {tab==='items' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">🏆 أكتر الأصناف مبيعاً</h3>
                {data.topItems.length===0 ? <div className="text-[#8a8884] text-sm text-center py-8">لا توجد بيانات</div> : (
                  <div className="space-y-3">
                    {data.topItems.map((it,i)=>(
                      <div key={it.name_ar} className="flex items-center gap-3">
                        <span className="text-[#8a8884] text-xs w-5 font-bold">{i+1}</span>
                        <span className="text-xl">{it.emoji}</span>
                        <div className="flex-1">
                          <div className="text-white text-sm font-bold">{it.name_ar}</div>
                          <div className="text-[#8a8884] text-xs">{fmt(it.revenue)}</div>
                        </div>
                        <span className={`text-xs font-black px-2 py-1 rounded-full ${i===0?'bg-[#f39c12]/20 text-[#f39c12]':i===1?'bg-[#8a8884]/20 text-[#8a8884]':i===2?'bg-[#cd7f32]/20 text-[#cd7f32]':'bg-[#2a2927] text-[#8a8884]'}`}>{it.qty} قطعة</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">📉 أقل الأصناف مبيعاً</h3>
                {data.bottomItems.length===0 ? <div className="text-[#8a8884] text-sm text-center py-8">لا توجد بيانات</div> : (
                  <div className="space-y-3">
                    {data.bottomItems.map((it)=>(
                      <div key={it.name_ar} className="flex items-center gap-3">
                        <span className="text-xl">{it.emoji}</span>
                        <div className="flex-1">
                          <div className="text-white text-sm font-bold">{it.name_ar}</div>
                          <div className="text-[#8a8884] text-xs">{fmt(it.revenue)}</div>
                        </div>
                        <span className="text-xs font-black px-2 py-1 rounded-full bg-[#2a1515] text-[#e74c3c]">{it.qty} قطعة</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cancels Tab */}
          {tab==='cancels' && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">❌ أسباب الإلغاء</h3>
                {data.cancelReasons.length===0 ? <div className="text-[#8a8884] text-sm text-center py-8">لا توجد إلغاءات 🎉</div> : (
                  <div className="space-y-3">
                    {data.cancelReasons.map(r=>(
                      <div key={r.reason} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-white text-sm">{r.reason}</div>
                          <div className="mt-1 bg-[#2a2927] rounded-full h-2">
                            <div className="h-full bg-[#e74c3c] rounded-full" style={{width:Math.max(4,r.count/data.cancelReasons[0].count*100)+'%'}}/>
                          </div>
                        </div>
                        <span className="text-[#e74c3c] font-black text-sm">{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
                <h3 className="text-white font-bold mb-4">🍽️ الأصناف الملغية</h3>
                {data.cancelledItems.length===0 ? <div className="text-[#8a8884] text-sm text-center py-8">لا توجد أصناف ملغية 🎉</div> : (
                  <div className="space-y-3">
                    {data.cancelledItems.map(it=>(
                      <div key={it.name_ar} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="text-white text-sm">{it.name_ar}</div>
                          <div className="text-[#8a8884] text-xs">{it.reason}</div>
                        </div>
                        <span className="text-[#e74c3c] font-black text-sm">{it.qty} ×</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tables Tab */}
          {tab==='tables' && (
            <div className="bg-[#1a1917] border border-[#2c2b29] rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">🪑 مبيعات الطاولات</h3>
              {data.tableBreakdown.length===0 ? <div className="text-[#8a8884] text-sm text-center py-8">لا توجد بيانات</div> : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.tableBreakdown.map(t=>(
                    <div key={t.table} className="flex items-center gap-3 bg-[#2a2927] rounded-xl p-3">
                      <span className="text-2xl">🪑</span>
                      <div className="flex-1">
                        <div className="text-white font-bold">{t.table}</div>
                        <div className="text-[#8a8884] text-xs">{t.orders} طلب</div>
                      </div>
                      <span className="text-[#f39c12] font-black">{fmt(t.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
