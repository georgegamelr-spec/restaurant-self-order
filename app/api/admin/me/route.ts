import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('admin_user')
  if (!cookie) return NextResponse.json({ user: null }, { status: 401 })
  try {
    return NextResponse.json({ user: JSON.parse(cookie.value) })
  } catch {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
