import { NextResponse } from 'next/server'

// Run migration using Supabase REST + service role
// Each table is created by inserting a dummy record and catching errors
// Instead, we use direct SQL via the pg package

export async function GET() {
  try {
    const { Pool } = await import('pg')

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })

    const client = await pool.connect()
    const results: { name: string; ok: boolean; error?: string }[] = []

    const steps: { name: string; sql: string }[] = [
      { name: 'suppliers', sql: `CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT,
        payment_terms TEXT DEFAULT 'cash', credit_days INT DEFAULT 0,
        notes TEXT, active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )` },
      { name: 'ingredients', sql: `CREATE TABLE IF NOT EXISTS ingredients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name_ar TEXT NOT NULL, name_en TEXT, unit TEXT NOT NULL DEFAULT 'kg',
        stock_qty NUMERIC(12,3) DEFAULT 0, min_stock NUMERIC(12,3) DEFAULT 0,
        cost_per_unit NUMERIC(10,2) DEFAULT 0,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        category TEXT DEFAULT 'other', barcode TEXT, active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )` },
      { name: 'product_recipes', sql: `CREATE TABLE IF NOT EXISTS product_recipes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id TEXT NOT NULL,
        ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        quantity NUMERIC(10,3) NOT NULL, unit TEXT NOT NULL, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(product_id, ingredient_id)
      )` },
      { name: 'stock_movements', sql: `CREATE TABLE IF NOT EXISTS stock_movements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        movement_type TEXT NOT NULL, quantity NUMERIC(12,3) NOT NULL,
        unit_cost NUMERIC(10,2), total_cost NUMERIC(10,2),
        reference_type TEXT, reference_id TEXT, notes TEXT, created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )` },
      { name: 'supplier_invoices', sql: `CREATE TABLE IF NOT EXISTS supplier_invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
        invoice_number TEXT, invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
        due_date DATE, total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        paid_amount NUMERIC(12,2) DEFAULT 0, payment_method TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'pending', notes TEXT, items JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      )` },
      { name: 'fn_update_updated_at', sql: `CREATE OR REPLACE FUNCTION update_updated_at()
        RETURNS TRIGGER AS $fn$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $fn$ LANGUAGE plpgsql` },
      { name: 'trg_suppliers', sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_suppliers_updated')
        THEN CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF; END $$` },
      { name: 'trg_ingredients', sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_ingredients_updated')
        THEN CREATE TRIGGER trg_ingredients_updated BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF; END $$` },
      { name: 'trg_invoices', sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_invoices_updated')
        THEN CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at(); END IF; END $$` },
      { name: 'fn_stock_movement', sql: `CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS TRIGGER AS $fn$
        BEGIN
          IF NEW.movement_type = 'in' THEN UPDATE ingredients SET stock_qty = stock_qty + NEW.quantity WHERE id = NEW.ingredient_id;
          ELSIF NEW.movement_type IN ('out','waste') THEN UPDATE ingredients SET stock_qty = GREATEST(0, stock_qty - NEW.quantity) WHERE id = NEW.ingredient_id;
          ELSIF NEW.movement_type = 'adjustment' THEN UPDATE ingredients SET stock_qty = NEW.quantity WHERE id = NEW.ingredient_id;
          END IF; RETURN NEW;
        END; $fn$ LANGUAGE plpgsql` },
      { name: 'trg_stock_movement', sql: `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_stock_movement')
        THEN CREATE TRIGGER trg_stock_movement AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION apply_stock_movement(); END IF; END $$` },
    ]

    try {
      for (const step of steps) {
        try {
          await client.query(step.sql)
          results.push({ name: step.name, ok: true })
        } catch (e: unknown) {
          results.push({ name: step.name, ok: false, error: (e as Error).message })
        }
      }
    } finally {
      client.release()
      await pool.end()
    }

    const failed = results.filter(r => !r.ok)
    return NextResponse.json({
      success: failed.length === 0,
      total: results.length,
      failed: failed.length,
      message: failed.length === 0 ? '✅ Migration completed successfully!' : `⚠️ ${failed.length} steps failed`,
      results
    })

  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}
