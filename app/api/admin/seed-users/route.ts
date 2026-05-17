import { NextResponse } from 'next/server'

const URL = 'https://uvhdsrkescbrgmdypppw.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2aGRzcmtlc2NicmdtZHlwcHB3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzE1NDA1NSwiZXhwIjoyMDkyNzMwMDU1fQ.-Di7O4t5d_dliTNuNdQjn9T2uSadd9jiLWFHCuMZ4KI'

export const runtime = 'nodejs'

export async function GET() {
  const log: string[] = []

  try {
    // Step 1: Create users table via SQL API
    const sqlBody = {
      query: `
        CREATE TABLE IF NOT EXISTS public.users (
          id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
          username      text UNIQUE NOT NULL,
          password_hash text NOT NULL,
          name          text NOT NULL,
          role          text NOT NULL,
          active        boolean DEFAULT true,
          created_at    timestamptz DEFAULT now()
        );
        ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
      `
    }

    const sqlRes = await fetch(URL + '/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(sqlBody)
    })
    log.push('create_table: ' + sqlRes.status + ' ' + await sqlRes.text())
  } catch (e: unknown) {
    log.push('create_table_error: ' + String(e))
  }

  // Step 2: Upsert users one by one
  const users = [
    { username: 'admin',   password_hash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',   name: 'Super Admin', role: 'super_admin', active: true },
    { username: 'manager', password_hash: '866485796cfa8d7c0cf7111640205b83076433547577511d81f8030ae99ecea5', name: 'المشرف',      role: 'manager',     active: true },
    { username: 'cashier', password_hash: 'b4c94003c562bb0d89535eca77f07284fe560fd48a7cc1ed99f0a56263d616ba', name: 'الكاشير',     role: 'cashier',     active: true },
    { username: 'kitchen', password_hash: 'e5cf9d8e3884bb2a899372b9fcb87af6fcd9b3aad2ff07e2c076b4a71ffad67c', name: 'المطبخ',      role: 'kitchen',     active: true },
  ]

  for (const u of users) {
    try {
      const r = await fetch(URL + '/rest/v1/users', {
        method: 'POST',
        headers: {
          'apikey': KEY,
          'Authorization': 'Bearer ' + KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(u),
      })
      const txt = await r.text()
      log.push(u.username + ': ' + r.status + (txt ? ' ' + txt : ' ✅'))
    } catch(e: unknown) {
      log.push(u.username + '_error: ' + String(e))
    }
  }

  // Step 3: Verify — list users
  let verifyData: unknown = null
  try {
    const vr = await fetch(URL + '/rest/v1/users?select=username,name,role,active', {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY }
    })
    verifyData = await vr.json()
  } catch(e: unknown) {
    verifyData = 'error: ' + String(e)
  }

  return NextResponse.json({ log, users: verifyData })
}

export async function POST() { return GET() }
