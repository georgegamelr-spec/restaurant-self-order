import { NextResponse } from 'next/server'
import { MENU_ITEMS } from '@/lib/menu'

export async function GET() {
  return NextResponse.json({ items: MENU_ITEMS })
}
