import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('product_id')
  let q = sb.from('product_recipes')
    .select('*, ingredient:ingredients(id,name_ar,unit,cost_per_unit)')
  if (productId) q = q.eq('product_id', productId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Calculate cost per recipe item
  const withCost = (data||[]).map(r => ({
    ...r,
    line_cost: r.ingredient?.cost_per_unit
      ? (() => {
          const ing = r.ingredient
          let qty = r.quantity
          // normalize to same unit as cost_per_unit (kg)
          if (r.unit === 'g' && ing.unit === 'kg')  qty = qty / 1000
          if (r.unit === 'ml' && ing.unit === 'L')  qty = qty / 1000
          if (r.unit === 'kg' && ing.unit === 'g')  qty = qty * 1000
          return qty * ing.cost_per_unit
        })()
      : 0
  }))
  const totalCost = withCost.reduce((s, r) => s + (r.line_cost || 0), 0)
  return NextResponse.json({ recipes: withCost, totalCost })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.product_id || !body.ingredient_id || !body.quantity)
    return NextResponse.json({ error: 'البيانات ناقصة' }, { status: 400 })
  const { data, error } = await sb.from('product_recipes')
    .upsert(body, { onConflict: 'product_id,ingredient_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipe: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })
  const { error } = await sb.from('product_recipes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
