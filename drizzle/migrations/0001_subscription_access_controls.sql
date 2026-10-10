CREATE TABLE public.subscription_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 paid_mode boolean NOT NULL DEFAULT false,
 trial_days integer NOT NULL DEFAULT 2 CHECK (trial_days IN (1,2)),
 monthly_price numeric(10,2) CHECK (monthly_price > 0),
 yearly_price numeric(10,2) CHECK (yearly_price > 0),
 currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.subscription_settings TO authenticated;
GRANT ALL ON public.subscription_settings TO service_role;
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read subscription settings" ON public.subscription_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins create subscription settings" ON public.subscription_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update subscription settings" ON public.subscription_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.subscription_access (
 user_id uuid PRIMARY KEY,
 trial_started_at timestamptz NOT NULL,
 trial_ends_at timestamptz NOT NULL,
 subscription_ends_at timestamptz,
 CHECK (trial_ends_at > trial_started_at)
);
GRANT SELECT ON public.subscription_access TO authenticated;
GRANT ALL ON public.subscription_access TO service_role;
ALTER TABLE public.subscription_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own subscription access" ON public.subscription_access FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.start_subscription_trial() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE days integer; paid boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to start your trial'; END IF;
 SELECT paid_mode, trial_days INTO paid, days FROM public.subscription_settings WHERE id = true;
 IF NOT coalesce(paid, false) THEN RAISE EXCEPTION 'The site is currently free'; END IF;
 INSERT INTO public.subscription_access (user_id, trial_started_at, trial_ends_at)
 VALUES (auth.uid(), now(), now() + make_interval(days => coalesce(days,2)))
 ON CONFLICT (user_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.start_subscription_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_subscription_trial() TO authenticated;
CREATE OR REPLACE FUNCTION public.can_use_subscription_app() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT NOT coalesce((SELECT paid_mode FROM public.subscription_settings WHERE id = true), false)
 OR (auth.uid() IS NOT NULL AND (
 public.has_role(auth.uid(), 'admin') OR EXISTS (
 SELECT 1 FROM public.subscription_access WHERE user_id = auth.uid()
 AND (trial_ends_at > now() OR subscription_ends_at > now())
 )));
$$;
REVOKE ALL ON FUNCTION public.can_use_subscription_app() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_use_subscription_app() TO anon, authenticated;
COMMENT ON TABLE public.subscription_access IS 'Trials start explicitly once per account; subscription expiry may only be written by verified payment processing.';