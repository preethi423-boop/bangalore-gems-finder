-- Run as the database migration/test role. All synthetic rows roll back.
BEGIN;
DO $$
DECLARE u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid(); m uuid := gen_random_uuid(); y uuid := gen_random_uuid(); result public.payment_orders; other_date timestamptz;
BEGIN
 INSERT INTO public.subscription_access(user_id,trial_started_at,trial_ends_at,subscription_ends_at) VALUES
 (u,'2026-01-01','2026-01-02','2030-01-31 10:00:00+00'),
 (other_u,'2026-01-01','2026-01-02','2030-03-01 10:00:00+00');
 INSERT INTO public.payment_orders(id,user_id,tier,mode,amount_paise,razorpay_order_id) VALUES
 (m,u,'monthly','live',2000,'order_TestMonthly' || replace(m::text,'-','')),
 (y,u,'yearly','live',20000,'order_TestYearly' || replace(y::text,'-',''));
 result := public.complete_payment_order(m,'pay_TestMonthly' || replace(m::text,'-',''));
 IF result.access_until <> '2030-02-28 10:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Monthly payment must add one calendar month preserving remaining paid time'; END IF;
 result := public.complete_payment_order(m,'pay_TestMonthly' || replace(m::text,'-',''));
 IF result.access_until <> '2030-02-28 10:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Duplicate confirmation extended access twice'; END IF;
 result := public.complete_payment_order(y,'pay_TestYearly' || replace(y::text,'-',''));
 IF result.access_until <> '2031-02-28 10:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Yearly payment must add one calendar year'; END IF;
 SELECT subscription_ends_at INTO other_date FROM public.subscription_access WHERE user_id = other_u;
 IF other_date <> '2030-03-01 10:00:00+00'::timestamptz THEN RAISE EXCEPTION 'Payment changed another user'; END IF;
 IF has_function_privilege('authenticated','public.complete_payment_order(uuid,text)','EXECUTE') OR has_function_privilege('anon','public.complete_payment_order(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Client can grant paid access'; END IF;
 IF has_table_privilege('authenticated','public.payment_orders','UPDATE') OR has_table_privilege('authenticated','public.payment_orders','INSERT') THEN RAISE EXCEPTION 'Client can edit payment proof'; END IF;
END $$;
ROLLBACK;