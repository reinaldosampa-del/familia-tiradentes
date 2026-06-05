
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  normalized text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO anon, authenticated;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public brands all" ON public.brands
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER brands_set_normalized
  BEFORE INSERT OR UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.sync_purchase_group_key();
-- Note: sync_purchase_group_key sets NEW.group_key. We need a dedicated trigger.

DROP TRIGGER IF EXISTS brands_set_normalized ON public.brands;

CREATE OR REPLACE FUNCTION public.sync_brand_normalized()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.normalized := public.normalize_name(NEW.name);
  RETURN NEW;
END;
$$;

CREATE TRIGGER brands_set_normalized
  BEFORE INSERT OR UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.sync_brand_normalized();

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS unit_kind text,
  ADD COLUMN IF NOT EXISTS pack_qty numeric,
  ADD COLUMN IF NOT EXISTS pack_size numeric,
  ADD COLUMN IF NOT EXISTS pack_size_unit text,
  ADD COLUMN IF NOT EXISTS items_per_pack numeric,
  ADD COLUMN IF NOT EXISTS rolls numeric,
  ADD COLUMN IF NOT EXISTS width_cm numeric,
  ADD COLUMN IF NOT EXISTS length_m numeric;
