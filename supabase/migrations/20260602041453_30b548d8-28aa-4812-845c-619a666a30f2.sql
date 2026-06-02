
-- Função auxiliar de normalização (igual à JS: minúsculas, sem acentos, espaços colapsados)
CREATE OR REPLACE FUNCTION public.normalize_name(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    lower(translate(coalesce(s,''),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '\s+', ' ', 'g'));
$$;

-- 1) Cor preferida do perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#3b82f6';

-- 2) Autor de cada item da lista
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- 3) Chave de agrupamento por nome (mesma "compra" em datas diferentes)
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS group_key text;

UPDATE public.purchases
  SET group_key = public.normalize_name(name)
  WHERE group_key IS NULL OR group_key = '';

CREATE INDEX IF NOT EXISTS purchases_group_key_idx ON public.purchases(group_key);

-- Mantém group_key sempre sincronizado com o nome
CREATE OR REPLACE FUNCTION public.sync_purchase_group_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.group_key := public.normalize_name(NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchases_group_key ON public.purchases;
CREATE TRIGGER trg_purchases_group_key
BEFORE INSERT OR UPDATE OF name ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.sync_purchase_group_key();

-- 4) Pré-lista compartilhada por group_key
ALTER TABLE public.pre_list_items
  ADD COLUMN IF NOT EXISTS group_key text;

UPDATE public.pre_list_items pli
  SET group_key = p.group_key
  FROM public.purchases p
  WHERE p.id = pli.purchase_id AND (pli.group_key IS NULL OR pli.group_key = '');

CREATE INDEX IF NOT EXISTS pre_list_items_group_key_idx ON public.pre_list_items(group_key);

-- Deduplica pré-lista por (group_key, nome normalizado) mantendo o mais recente
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY group_key, public.normalize_name(name)
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
  FROM public.pre_list_items
  WHERE group_key IS NOT NULL AND trim(name) <> ''
)
DELETE FROM public.pre_list_items WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pre_list_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
