import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const results: string[] = []
  const defaultUsers = [
    { username: 'admin',   password: 'admin123',   name: 'Super Admin', role: 'super_admin' },
    { username: 'manager', password: 'manager123', name: 'المشرف',      role: 'manager' },
    { username: 'cashier', password: 'cashier123', name: 'الكاشير',     role: 'cashier' },
    { username: 'kitchen', password: 'kitchen123', name: 'المطبخ',      role: 'kitchen' },
  ]
  for (const u of defaultUsers) {
    const hash = createHash('sha256').update(u.password).digest('hex')
    const { error } = await supabase
      .from('users')
      .upsert(
        { username: u.username, password_hash: hash, name: u.name, role: u.role, active: true },
        { onConflict: 'username' }
      )
    results.push(`${u.username}: ${error ? '❌ ' + error.message : '✅ ok'}`)
  }
  return NextResponse.json({ ok: true, results })
}

export async function GET() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, role, active')
  return NextResponse.json({ users: data, error: error?.message })
}
