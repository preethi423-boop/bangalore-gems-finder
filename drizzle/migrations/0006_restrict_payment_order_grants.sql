REVOKE ALL ON public.payment_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;