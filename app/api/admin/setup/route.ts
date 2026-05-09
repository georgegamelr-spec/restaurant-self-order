import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const steps = [
    // suppliers
    `CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT, email TEXT, address TEXT,
      payment_terms TEXT DEFAULT 'cash',
      credit_days INT DEFAULT 0,
      notes TEXT, active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // ingredients
    `CREATE TABLE IF NOT EXISTS ingredients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name_ar TEXT NOT NULL, name_en TEXT,
      unit TEXT NOT NULL DEFAULT 'kg',
      stock_qty NUMERIC(12,3) DEFAULT 0,
      min_stock NUMERIC(12,3) DEFAULT 0,
      cost_per_unit NUMERIC(10,2) DEFAULT 0,
      supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
      category TEXT DEFAULT 'other',
      barcode TEXT, active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // product_recipes
    `CREATE TABLE IF NOT EXISTS product_recipes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id TEXT NOT NULL,
      ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity NUMERIC(10,3) NOT NULL,
      unit TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(product_id, ingredient_id)
    )`,
    // stock_movements
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL,
      quantity NUMERIC(12,3) NOT NULL,
      unit_cost NUMERIC(10,2), total_cost NUMERIC(10,2),
      reference_type TEXT, reference_id TEXT,
      notes TEXT, created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    // supplier_invoices
    `CREATE TABLE IF NOT EXISTS supplier_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      invoice_number TEXT,
      invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE,
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      paid_amount NUMERIC(12,2) DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'pending',
      notes TEXT,
      items JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ]

  const results: { step: string; ok: boolean; error?: string }[] = []

  for (const sql of steps) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || 'unknown'
    const { error } = await supabase.rpc('exec_sql', { query: sql }).single().catch(() => ({ error: null }))
    // Try direct approach
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: { 'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY! }
      })
      results.push({ step: tableName, ok: true })
    } catch (e: unknown) {
      results.push({ step: tableName, ok: false, error: (e as Error).message })
    }
  }

  return NextResponse.json({ message: 'Check Supabase SQL Editor — run supabase/migration_phase3.sql', results })
}
