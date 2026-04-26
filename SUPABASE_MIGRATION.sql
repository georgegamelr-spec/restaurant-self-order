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
