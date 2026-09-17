CREATE TABLE public.bot_runtime_lease (id integer PRIMARY KEY CHECK(id = 1), holder text NOT NULL, expires_at timestamptz NOT NULL);
ALTER TABLE public.bot_runtime_lease ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_runtime_lease FROM anon, authenticated;
CREATE OR REPLACE FUNCTION public.acquire_bot_lease(p_holder text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
  INSERT INTO bot_runtime_lease VALUES(1, p_holder, now() + interval '35 seconds')
  ON CONFLICT(id) DO UPDATE SET holder = EXCLUDED.holder, expires_at = EXCLUDED.expires_at
    WHERE bot_runtime_lease.holder = p_holder OR bot_runtime_lease.expires_at < now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed > 0;
END $$;
REVOKE ALL ON FUNCTION public.acquire_bot_lease(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_bot_lease(text) TO service_role;
