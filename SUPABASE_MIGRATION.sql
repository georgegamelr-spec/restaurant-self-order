-- =============================================
-- Restaurant Self Order — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number  text NOT NULL,
  session_id    text NOT NULL,
  items         jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('draft','submitted','preparing','ready','done')),
  notes         text DEFAULT '',
  total         numeric(10,2) NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_updated_at ON public.orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_orders_status       ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table        ON public.orders(table_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_session_id   ON public.orders(session_id);

-- 4. Row Level Security — allow all for anon (adjust for production)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON public.orders;
CREATE POLICY "Allow all for anon"
  ON public.orders FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Done!
SELECT 'Migration complete ✅' as result;

-- =============================================
-- DASHBOARD MIGRATION — Run after initial migration
-- =============================================

-- 1. Users & Auth
CREATE TABLE IF NOT EXISTS public.users (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('super_admin','manager','cashier','kitchen')),
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Default super admin (password: admin123)
INSERT INTO public.users (username, password_hash, name, role)
VALUES ('admin', encode(digest('admin123','sha256'),'hex'), 'Super Admin', 'super_admin')
ON CONFLICT (username) DO NOTHING;

-- 2. Ingredients (المكونات/المخزون)
CREATE TABLE IF NOT EXISTS public.ingredients (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  unit          text NOT NULL, -- kg, g, L, ml, pcs
  stock_qty     numeric(10,3) DEFAULT 0,
  min_stock     numeric(10,3) DEFAULT 0, -- تنبيه لما ينزل تحته
  cost_per_unit numeric(10,2) DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 3. Recipes (الوصفات)
CREATE TABLE IF NOT EXISTS public.recipes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id  text NOT NULL, -- references menu item id from lib/menu.ts
  name          text NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- 4. Recipe Items (مكونات الوصفة)
CREATE TABLE IF NOT EXISTS public.recipe_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id     uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE,
  qty           numeric(10,3) NOT NULL,
  unit          text NOT NULL
);

-- 5. Suppliers (الموردين)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  notes         text,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- 6. Purchase Orders (طلبات الشراء)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id   uuid REFERENCES public.suppliers(id),
  status        text DEFAULT 'draft' CHECK (status IN ('draft','sent','received','cancelled')),
  currency      text DEFAULT 'EGP' CHECK (currency IN ('EGP','USD')),
  exchange_rate numeric(10,2) DEFAULT 1,
  total_egp     numeric(10,2) DEFAULT 0,
  notes         text,
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 7. Purchase Order Items
CREATE TABLE IF NOT EXISTS public.po_items (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  po_id         uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id),
  qty           numeric(10,3) NOT NULL,
  unit          text NOT NULL,
  unit_price    numeric(10,2) NOT NULL,
  currency      text DEFAULT 'EGP'
);

-- 8. Inventory Logs (حركات المخزون)
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id uuid REFERENCES public.ingredients(id),
  type          text NOT NULL CHECK (type IN ('in','out','adjust')),
  qty           numeric(10,3) NOT NULL,
  reason        text, -- 'purchase_order', 'recipe_usage', 'manual_adjust', 'waste'
  reference_id  uuid, -- po_id or order_id
  notes         text,
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz DEFAULT now()
);

-- 9. Add guest_count to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_count int DEFAULT 1;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EGP';

-- 10. Triggers for updated_at
DROP TRIGGER IF EXISTS ingredients_updated_at ON public.ingredients;
CREATE TRIGGER ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 11. Indexes
CREATE INDEX IF NOT EXISTS idx_ingredients_stock ON public.ingredients(stock_qty);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_ingredient ON public.inventory_logs(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_recipe_menu_item ON public.recipes(menu_item_id);

-- 12. RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;
BEGIN FOR t IN SELECT unnest(ARRAY['users','ingredients','recipes','recipe_items','suppliers','purchase_orders','po_items','inventory_logs'])
  LOOP EXECUTE format('DROP POLICY IF EXISTS "Allow all for anon" ON public.%I; CREATE POLICY "Allow all for anon" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
END $$;

-- 13. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_logs;

SELECT 'Dashboard migration complete ✅' as result;
