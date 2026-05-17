import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const results: string[] = []

  // 1. Create users table if not exists
  const { error: tableErr } = await supabase.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  })
  if (tableErr) {
    // Try direct approach — table may already exist
    results.push('table: ' + (tableErr.message || 'already exists'))
  } else {
    results.push('table: created/exists ✓')
  }

  // 2. Default users to seed
  const defaultUsers = [
    { username: 'admin',   password: 'admin123',   name: 'المدير', role: 'admin' },
    { username: 'manager', password: 'manager123', name: 'المشرف', role: 'manager' },
    { username: 'cashier', password: 'cashier123', name: 'الكاشير', role: 'cashier' },
    { username: 'waiter',  password: 'waiter123',  name: 'النادل',  role: 'waiter' },
  ]

  for (const u of defaultUsers) {
    const hash = createHash('sha256').update(u.password).digest('hex')
    const { error } = await supabase
      .from('users')
      .upsert({ username: u.username, password_hash: hash, name: u.name, role: u.role, active: true }, {
        onConflict: 'username',
        ignoreDuplicates: false
      })
    results.push(`${u.username}: ${error ? '❌ ' + error.message : '✅ inserted/updated'}`)
  }

  return NextResponse.json({ ok: true, results })
}

export async function GET() {
  // Quick check — list users (no passwords)
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, role, active')
  return NextResponse.json({ users: data, error: error?.message })
}
