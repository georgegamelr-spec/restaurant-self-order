import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createHash } from 'crypto'

export async function POST(req: NextRequest) {
  const { username, name, role, password, active } = await req.json()
  const hash = createHash('sha256').update(password).digest('hex')
  const { data, error } = await supabase.from('users').insert({ username, name, role, password_hash: hash, active }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data })
}

export async function PATCH(req: NextRequest) {
  const { id, username, name, role, password, active } = await req.json()
  const updates: Record<string,unknown> = { username, name, role, active }
  if (password) updates.password_hash = createHash('sha256').update(password).digest('hex')
  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ user: data })
}
