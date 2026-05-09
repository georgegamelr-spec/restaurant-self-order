import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || 'today'

    const now = new Date()
    let from: Date

    if (range === 'today') {
      from = new Date(now); from.setHours(0,0,0,0)
    } else if (range === 'week') {
      from = new Date(now); from.setDate(now.getDate() - 7)
    } else if (range === 'month') {
      from = new Date(now); from.setDate(1); from.setHours(0,0,0,0)
    } else {
      from = new Date(now); from.setHours(0,0,0,0)
    }

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', from.toISOString())
      .neq('status', 'draft')

    if (error) throw error

    const allOrders = orders || []
    const activeOrders = allOrders.filter(o => o.status !== 'cancelled')
    const cancelledOrders = allOrders.filter(o => o.status === 'cancelled')

    // Revenue
    const totalRevenue = activeOrders.reduce((s, o) => s + (o.total || 0), 0)
    const totalTax = totalRevenue * 0.1 / 1.1
    const netRevenue = totalRevenue - totalTax
    const avgOrderValue = activeOrders.length ? totalRevenue / activeOrders.length : 0

    // Item sales map
    const itemMap: Record<string, { name: string; name_ar: string; emoji: string; qty: number; revenue: number }> = {}
    activeOrders.forEach(o => {
      ;(o.items || []).forEach((it: { name?: string; name_ar: string; emoji: string; price: number; qty: number }) => {
        const key = it.name_ar
        if (!itemMap[key]) itemMap[key] = { name: it.name || it.name_ar, name_ar: it.name_ar, emoji: it.emoji || '🍽️', qty: 0, revenue: 0 }
        itemMap[key].qty += it.qty
        itemMap[key].revenue += it.price * it.qty
      })
    })
    const itemsSorted = Object.values(itemMap).sort((a, b) => b.qty - a.qty)
    const topItems = itemsSorted.slice(0, 10)
    const bottomItems = [...itemsSorted].reverse().slice(0, 5)
    const totalItemsSold = itemsSorted.reduce((s, i) => s + i.qty, 0)

    // Cancelled items
    const cancelledItemMap: Record<string, { name_ar: string; qty: number; reason: string }> = {}
    cancelledOrders.forEach(o => {
      ;(o.items || []).forEach((it: { name_ar: string; qty: number }) => {
        if (!cancelledItemMap[it.name_ar]) cancelledItemMap[it.name_ar] = { name_ar: it.name_ar, qty: 0, reason: o.cancel_reason || 'غير محدد' }
        cancelledItemMap[it.name_ar].qty += it.qty
      })
    })
    const cancelledItems = Object.values(cancelledItemMap).sort((a, b) => b.qty - a.qty)

    // Cancel reasons breakdown
    const reasonMap: Record<string, number> = {}
    cancelledOrders.forEach(o => {
      const r = o.cancel_reason || 'غير محدد'
      reasonMap[r] = (reasonMap[r] || 0) + 1
    })
    const cancelReasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count })).sort((a,b) => b.count - a.count)

    // Hourly breakdown
    const hourMap: Record<string, { count: number; total: number }> = {}
    activeOrders.forEach(o => {
      const h = new Date(o.created_at).getHours().toString().padStart(2, '0') + ':00'
      if (!hourMap[h]) hourMap[h] = { count: 0, total: 0 }
      hourMap[h].count++
      hourMap[h].total += o.total || 0
    })
    const hourlyBreakdown = Object.entries(hourMap)
      .map(([hour, v]) => ({ hour, ...v }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
    const peakHour = hourlyBreakdown.reduce((a, b) => b.count > a.count ? b : a, { hour: '-', count: 0, total: 0 })

    // Table breakdown
    const tableMap: Record<string, { orders: number; total: number }> = {}
    activeOrders.forEach(o => {
      const t = 'طاولة ' + o.table_number
      if (!tableMap[t]) tableMap[t] = { orders: 0, total: 0 }
      tableMap[t].orders++
      tableMap[t].total += o.total || 0
    })
    const tableBreakdown = Object.entries(tableMap)
      .map(([table, v]) => ({ table, ...v }))
      .sort((a, b) => b.total - a.total)

    return NextResponse.json({
      range,
      summary: {
        totalOrders: activeOrders.length,
        cancelledOrders: cancelledOrders.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        totalItemsSold,
      },
      topItems,
      bottomItems,
      cancelledItems,
      cancelReasons,
      hourlyBreakdown,
      peakHour,
      tableBreakdown,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
