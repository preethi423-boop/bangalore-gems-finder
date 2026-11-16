DROP POLICY IF EXISTS "Read subscription settings" ON public.subscription_settings;
CREATE POLICY "Admins read subscription settings" ON public.subscription_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_subscription_settings()
RETURNS SETOF public.subscription_settings
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.paid_mode, s.trial_days, s.monthly_price, s.yearly_price, s.currency, s.updated_at, s.trial_duration_days,
    CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN s.upi_id END,
    CASE WHEN public.has_role(auth.uid(), 'admin'::app_role) THEN s.upi_payee_name END
  FROM public.subscription_settings s WHERE s.id = true
$$;
REVOKE ALL ON FUNCTION public.get_subscription_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_settings() TO anon, authenticated;