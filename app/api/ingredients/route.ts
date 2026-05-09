import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await sb
    .from('ingredients')
    .select('*, supplier:suppliers(id,name)')
    .order('category').order('name_ar')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ingredients: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.name_ar || !body.unit) return NextResponse.json({ error: 'الاسم والوحدة مطلوبان' }, { status: 400 })
  const { data, error } = await sb.from('ingredients').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ingredient: data }, { status: 201 })
}
