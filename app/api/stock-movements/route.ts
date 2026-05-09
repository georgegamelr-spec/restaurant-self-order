import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ingredientId = searchParams.get('ingredient_id')
  const limit = Number(searchParams.get('limit') || 50)
  let q = sb.from('stock_movements')
    .select('*, ingredient:ingredients(name_ar,unit)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (ingredientId) q = q.eq('ingredient_id', ingredientId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movements: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.ingredient_id || !body.movement_type || !body.quantity)
    return NextResponse.json({ error: 'البيانات ناقصة' }, { status: 400 })
  if (body.unit_cost && body.quantity)
    body.total_cost = body.unit_cost * body.quantity
  const { data, error } = await sb.from('stock_movements').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movement: data }, { status: 201 })
}
