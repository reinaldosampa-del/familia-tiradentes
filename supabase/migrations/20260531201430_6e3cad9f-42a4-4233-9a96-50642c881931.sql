CREATE TABLE public.pre_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  name TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pre_list_items_purchase_id ON public.pre_list_items(purchase_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_list_items TO anon, authenticated;
GRANT ALL ON public.pre_list_items TO service_role;

ALTER TABLE public.pre_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public pre_list_items all" ON public.pre_list_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_list_items;
ALTER TABLE public.pre_list_items REPLICA IDENTITY FULL;