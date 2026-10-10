ALTER TABLE public.subscription_settings ADD COLUMN trial_duration_days integer NOT NULL DEFAULT 2 CHECK (trial_duration_days BETWEEN 1 AND 15), ADD COLUMN upi_id text, ADD COLUMN upi_payee_name text;
UPDATE public.subscription_settings SET trial_duration_days = trial_days;
COMMENT ON COLUMN public.subscription_settings.trial_days IS 'DEPRECATED: replaced by trial_duration_days for 1 to 15 day trials';
ALTER TABLE public.subscription_settings ADD CONSTRAINT valid_upi_setup CHECK ((upi_id IS NULL AND upi_payee_name IS NULL) OR (upi_id ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$' AND length(upi_id) <= 100 AND length(trim(upi_payee_name)) BETWEEN 1 AND 100));
CREATE OR REPLACE FUNCTION public.start_subscription_trial() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE days integer; paid boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to start your trial'; END IF;
 SELECT paid_mode, trial_duration_days INTO paid, days FROM public.subscription_settings WHERE id = true;
 IF NOT coalesce(paid, false) THEN RAISE EXCEPTION 'The site is currently free'; END IF;
 INSERT INTO public.subscription_access (user_id, trial_started_at, trial_ends_at) VALUES (auth.uid(), now(), now() + make_interval(days => coalesce(days,2))) ON CONFLICT (user_id) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.start_subscription_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_subscription_trial() TO authenticated;