CREATE TABLE public.ai_exploration_state (
  id text PRIMARY KEY,
  status_code integer NOT NULL,
  message text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_exploration_state TO service_role;
REVOKE ALL ON public.ai_exploration_state FROM anon, authenticated;
ALTER TABLE public.ai_exploration_state ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.ai_exploration_state IS 'Server-only durable pause state for AI access, credit and provider failures; no client policies intentionally.';