import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { OrderItem } from '@/types'

// PATCH /api/orders/[id] — add items or update status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { action, items, status, session_id } = body
    const orderId = params.id

    // Fetch existing order first
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // ADD ITEMS — only allowed if session matches and status is submitted
    if (action === 'add_items') {
      if (existing.session_id !== session_id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
      if (!['submitted', 'preparing'].includes(existing.status)) {
        return NextResponse.json({ error: 'Cannot add items to this order' }, { status: 400 })
      }

      const existingItems: OrderItem[] = existing.items
      const updatedItems = [...existingItems]

      items.forEach((newItem: OrderItem) => {
        const idx = updatedItems.findIndex(i => i.menu_item_id === newItem.menu_item_id)
        if (idx >= 0) {
          updatedItems[idx].qty += newItem.qty
        } else {
          updatedItems.push(newItem)
        }
      })

      const newTotal = updatedItems.reduce((sum, i) => sum + i.price * i.qty, 0)

      const { data, error } = await supabase
        .from('orders')
        .update({ items: updatedItems, total: Math.round(newTotal * 100) / 100 })
        .eq('id', orderId)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ order: data })
    }

    // UPDATE STATUS — for kitchen use
    if (action === 'update_status') {
      const validStatuses = ['preparing', 'ready', 'done']
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ order: data })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// GET /api/orders/[id] — get single order by id or session
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error
    return NextResponse.json({ order: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
