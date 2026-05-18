-- =============================================
-- Restaurant Self Order — Docker Init SQL
-- Runs automatically on first PostgreSQL start
-- =============================================

-- Create anon role for PostgREST
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'restaurant_anon') THEN
    CREATE ROLE restaurant_anon NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO restaurant_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO restaurant_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO restaurant_anon;

-- ─── Orders ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.orders (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number text NOT NULL,
  session_id   text NOT NULL,
  items        jsonb NOT NULL DEFAULT '[]',
  status       text NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('draft','submitted','preparing','ready','done','cancelled')),
  notes        text DEFAULT '',
  total        numeric(10,2) NOT NULL DEFAULT 0,
  cancel_reason   text,
  cancelled_by    text,
  cancelled_at    timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table      ON public.orders(table_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_session    ON public.orders(session_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

INSERT INTO public.users (username, password_hash, name, role, active) VALUES
  ('admin',   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',   'Super Admin', 'super_admin', true),
  ('manager', '866485796cfa8d7c0cf7111640205b83076433547577511d81f8030ae99ecea5', 'المشرف',      'manager',     true),
  ('cashier', 'b4c94003c562bb0d89535eca77f07284fe560fd48a7cc1ed99f0a56263d616ba', 'الكاشير',     'cashier',     true),
  ('kitchen', 'e5cf9d8e3884bb2a899372b9fcb87af6fcd9b3aad2ff07e2c076b4a71ffad67c', 'المطبخ',      'kitchen',     true)
ON CONFLICT (username) DO NOTHING;

-- ─── Suppliers ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  phone         text,
  email         text,
  address       text,
  payment_terms text DEFAULT 'cash',
  credit_days   int DEFAULT 0,
  notes         text,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ─── Ingredients ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingredients (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name_ar       text NOT NULL,
  name_en       text,
  unit          text NOT NULL DEFAULT 'kg',
  stock_qty     numeric(12,3) DEFAULT 0,
  min_stock     numeric(12,3) DEFAULT 0,
  cost_per_unit numeric(10,2) DEFAULT 0,
  supplier_id   uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  category      text DEFAULT 'other',
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ─── Product Recipes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_recipes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id    text NOT NULL,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity      numeric(10,3) NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ─── Stock Movements ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('in','out','adjustment','waste')),
  quantity      numeric(12,3) NOT NULL,
  notes         text,
  reference_id  text,
  created_by    text,
  created_at    timestamptz DEFAULT now()
);

-- ─── Supplier Invoices ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id   uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invoice_number text,
  total_amount  numeric(12,2) NOT NULL DEFAULT 0,
  paid          boolean DEFAULT false,
  due_date      date,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

SELECT 'Database initialized successfully ✅' AS result;
