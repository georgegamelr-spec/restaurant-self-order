import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(req: NextRequest) {
  const { orderId, managerPassword, reason } = await req.json()

  if (!orderId || !managerPassword) {
    return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 })
  }

  // 1. Verify manager password
  const passwordHash = hashPassword(managerPassword)
  const { data: manager, error: authError } = await supabase
    .from('users')
    .select('id, name, role')
    .in('role', ['super_admin', 'manager'])
    .eq('password_hash', passwordHash)
    .eq('active', true)
    .single()

  if (authError || !manager) {
    return NextResponse.json({ error: 'باسورد المدير غلط' }, { status: 401 })
  }

  // 2. Get order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 })
  }

  if (!['submitted', 'preparing'].includes(order.status)) {
    return NextResponse.json({ error: 'لا يمكن إلغاء هذا الطلب' }, { status: 400 })
  }

  // 3. Cancel order
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_by: manager.name,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (updateError) {
    return NextResponse.json({ error: 'فشل إلغاء الطلب' }, { status: 500 })
  }

  return NextResponse.json({ success: true, cancelledBy: manager.name })
}
