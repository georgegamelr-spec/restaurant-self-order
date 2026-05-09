-- ============================================
-- Restaurant App — Phase 3 Migration
-- Run once in Supabase SQL Editor
-- ============================================

-- 1. SUPPLIERS (الموردين)
CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  payment_terms TEXT DEFAULT 'cash', -- cash | credit | transfer
  credit_days  INT DEFAULT 0,
  notes        TEXT,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INGREDIENTS (المكونات / المخزون)
CREATE TABLE IF NOT EXISTS ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar         TEXT NOT NULL,
  name_en         TEXT,
  unit            TEXT NOT NULL DEFAULT 'kg',  -- kg | g | L | ml | pcs | box
  stock_qty       NUMERIC(12,3) DEFAULT 0,
  min_stock       NUMERIC(12,3) DEFAULT 0,     -- حد إعادة الطلب
  cost_per_unit   NUMERIC(10,2) DEFAULT 0,     -- سعر الوحدة (للكيلو مثلاً)
  supplier_id     UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  category        TEXT DEFAULT 'other',        -- meat | dairy | vegetables | beverages | dry | other
  barcode         TEXT,
  active          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCT RECIPES (وصفة كل صنف)
CREATE TABLE IF NOT EXISTS product_recipes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     TEXT NOT NULL,               -- references products.id
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity       NUMERIC(10,3) NOT NULL,      -- الكمية المستخدمة
  unit           TEXT NOT NULL,               -- وحدة القياس في الوصفة
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, ingredient_id)
);

-- 4. STOCK MOVEMENTS (حركة المخزون)
CREATE TABLE IF NOT EXISTS stock_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  movement_type   TEXT NOT NULL,  -- in | out | adjustment | waste
  quantity        NUMERIC(12,3) NOT NULL,
  unit_cost       NUMERIC(10,2),
  total_cost      NUMERIC(10,2),
  reference_type  TEXT,           -- invoice | order | manual | waste
  reference_id    TEXT,           -- invoice_id or order_id
  notes           TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SUPPLIER INVOICES (فواتير الموردين)
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_number TEXT,
  invoice_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount    NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',   -- cash | transfer | check
  status         TEXT DEFAULT 'pending', -- pending | partial | paid
  notes          TEXT,
  items          JSONB DEFAULT '[]',    -- [{ingredient_id, name, qty, unit, unit_cost, total}]
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier ON ingredients(supplier_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product      ON product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipes_ingredient   ON product_recipes(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_movements_type       ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier    ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON supplier_invoices(status);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON suppliers         FOR ALL USING (true);
CREATE POLICY "service_role_all" ON ingredients       FOR ALL USING (true);
CREATE POLICY "service_role_all" ON product_recipes   FOR ALL USING (true);
CREATE POLICY "service_role_all" ON stock_movements   FOR ALL USING (true);
CREATE POLICY "service_role_all" ON supplier_invoices FOR ALL USING (true);

-- ============================================
-- FUNCTION: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_suppliers_updated
  BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_ingredients_updated
  BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON supplier_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTION: update stock on movement
-- ============================================
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.movement_type = 'in' THEN
    UPDATE ingredients SET stock_qty = stock_qty + NEW.quantity WHERE id = NEW.ingredient_id;
  ELSIF NEW.movement_type IN ('out','waste') THEN
    UPDATE ingredients SET stock_qty = GREATEST(0, stock_qty - NEW.quantity) WHERE id = NEW.ingredient_id;
  ELSIF NEW.movement_type = 'adjustment' THEN
    UPDATE ingredients SET stock_qty = NEW.quantity WHERE id = NEW.ingredient_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_stock_movement
  AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();
