import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// Use service role to bypass RLS on users table
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password)
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

  const hash = createHash('sha256').update(password).digest('hex')

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, username, name, role, active')
    .eq('username', username)
    .eq('password_hash', hash)
    .eq('active', true)
    .single()

  if (error || !user)
    return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غلط' }, { status: 401 })

  const res = NextResponse.json({ user })
  res.cookies.set('admin_user', JSON.stringify({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role
  }), {
    httpOnly: false,
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('admin_user')
  return res
}
