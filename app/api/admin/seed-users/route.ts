import { NextResponse } from 'next/server'

// Temporary seed route — hardcoded credentials for one-time setup
const SUPABASE_URL = 'https://uvhdsrkescbrgmdypppw.supabase.co'
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2aGRzcmtlc2NicmdtZHlwcHB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE1NDA1NSwiZXhwIjoyMDkyNzMwMDU1fQ.-Di7O4t5d_dliTNuNdQjn9T2uSadd9jiLWFHCuMZ4KI'

async function sbPost(body: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(body),
  })
  return res.ok ? 'ok' : await res.text()
}

export async function GET() {
  const results: Record<string, string> = {}

  const users = [
    { username: 'admin',   password_hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',   name: 'Super Admin', role: 'super_admin', active: true },
    { username: 'manager', password_hash: '866485796cfa8d7c0cf7111640205b83076433547577511d81f8030ae99ecea5', name: 'المشرف',      role: 'manager',     active: true },
    { username: 'cashier', password_hash: 'b4c94003c562bb0d89535eca77f07284fe560fd48a7cc1ed99f0a56263d616ba', name: 'الكاشير',     role: 'cashier',     active: true },
    { username: 'kitchen', password_hash: 'e5cf9d8e3884bb2a899372b9fcb87af6fcd9b3aad2ff07e2c076b4a71ffad67c', name: 'المطبخ',      role: 'kitchen',     active: true },
  ]

  for (const u of users) {
    results[u.username] = await sbPost(u)
  }

  // Verify
  const check = await fetch(`${SUPABASE_URL}/rest/v1/users?select=username,role,active`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const verified = await check.json()

  return NextResponse.json({ results, users: verified })
}

export async function POST() {
  return GET()
}
