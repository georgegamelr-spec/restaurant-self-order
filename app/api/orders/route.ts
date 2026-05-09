import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { OrderItem } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { table_number, session_id, items, notes, guest_count, source } = body

    if (!table_number || !session_id || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const total = items.reduce((sum: number, item: OrderItem) => sum + item.price * item.qty, 0)

    const { data, error } = await supabase
      .from('orders')
      .insert({
        table_number,
        session_id,
        items,
        notes: notes || '',
        status: 'submitted',
        total: Math.round(total * 100) / 100,
        guest_count: guest_count || 1,
        source: source || 'customer',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ order: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const table = searchParams.get('table')

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (table) query = query.eq('table_number', table)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ orders: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

