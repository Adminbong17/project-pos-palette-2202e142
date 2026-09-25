CREATE TABLE IF NOT EXISTS public.short_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Short Product List',
  list_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Dhaka')::date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS short_lists_business_idx ON public.short_lists (business_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_lists TO authenticated;
GRANT ALL ON public.short_lists TO service_role;

ALTER TABLE public.short_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members manage short_lists" ON public.short_lists;
CREATE POLICY "Members manage short_lists" ON public.short_lists
  FOR ALL TO authenticated
  USING (is_business_member(auth.uid(), business_id))
  WITH CHECK (is_business_member(auth.uid(), business_id));

DROP TRIGGER IF EXISTS short_lists_set_updated_at ON public.short_lists;
CREATE TRIGGER short_lists_set_updated_at BEFORE UPDATE ON public.short_lists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();