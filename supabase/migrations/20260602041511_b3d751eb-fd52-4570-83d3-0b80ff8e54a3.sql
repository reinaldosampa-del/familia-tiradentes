
CREATE OR REPLACE FUNCTION public.normalize_name(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    lower(translate(coalesce(s,''),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.sync_purchase_group_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.group_key := public.normalize_name(NEW.name);
  RETURN NEW;
END;
$$;
