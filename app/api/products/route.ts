import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/products
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const available = searchParams.get('available')

    let query = supabase.from('products').select('*').order('category').order('name_ar')
    if (category) query = query.eq('category', category)
    if (available === 'true') query = query.eq('available', true)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ products: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/products — add new product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name_ar, name_en, price, category, emoji, description, available } = body

    if (!name_ar || !price || !category) {
      return NextResponse.json({ error: 'الاسم والسعر والقسم مطلوبين' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name_ar,
        name_en: name_en || name_ar,
        price: Number(price),
        category,
        emoji: emoji || '🍽️',
        description: description || '',
        available: available ?? true,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
