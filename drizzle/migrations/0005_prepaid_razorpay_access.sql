ALTER TABLE public.subscription_access ADD COLUMN trial_started_explicitly boolean NOT NULL DEFAULT true;
CREATE TABLE public.payment_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 tier text NOT NULL CHECK (tier IN ('monthly','yearly')),
 mode text NOT NULL CHECK (mode IN ('test','live')),
 amount_paise bigint NOT NULL CHECK (amount_paise >= 100),
 currency text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
 razorpay_order_id text UNIQUE,
 razorpay_payment_id text UNIQUE,
 creation_attempt_at timestamptz,
 access_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz
);
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own payment orders" ON public.payment_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX payment_orders_pending_unique ON public.payment_orders(user_id,tier,mode,amount_paise) WHERE status = 'pending';
CREATE OR REPLACE FUNCTION public.reserve_payment_order(_tier text, _mode text) RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE price numeric; result public.payment_orders;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to pay'; END IF;
 IF _tier NOT IN ('monthly','yearly') OR _mode NOT IN ('test','live') THEN RAISE EXCEPTION 'Invalid plan'; END IF;
 SELECT CASE WHEN _tier = 'monthly' THEN monthly_price ELSE yearly_price END INTO price FROM public.subscription_settings WHERE id = true;
 IF price IS NULL OR round(price * 100) < 100 OR round(price * 100) > 999999999 THEN RAISE EXCEPTION 'This plan price is not available for payment'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 SELECT * INTO result FROM public.payment_orders WHERE user_id = auth.uid() AND tier = _tier AND mode = _mode AND amount_paise = round(price * 100) AND status = 'pending';
 IF result.id IS NULL THEN
 INSERT INTO public.payment_orders(user_id,tier,mode,amount_paise) VALUES(auth.uid(),_tier,_mode,round(price*100)) RETURNING * INTO result;
 END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_payment_order(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_payment_order(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.complete_payment_order(_order_id uuid, _payment_id text) RETURNS public.payment_orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE purchase public.payment_orders; deadline timestamptz;
BEGIN
 SELECT * INTO purchase FROM public.payment_orders WHERE id = _order_id FOR UPDATE;
 IF purchase.id IS NULL THEN RAISE EXCEPTION 'Unknown order'; END IF;
 IF purchase.status = 'paid' THEN RETURN purchase; END IF;
 IF purchase.mode <> 'live' OR purchase.razorpay_order_id IS NULL OR _payment_id !~ '^pay_[A-Za-z0-9]+$' THEN RAISE EXCEPTION 'Verified live payment required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(purchase.user_id::text,1));
 SELECT greatest(now(), subscription_ends_at) INTO deadline FROM public.subscription_access WHERE user_id = purchase.user_id;
 deadline := coalesce(deadline,now()) + CASE WHEN purchase.tier = 'monthly' THEN interval '1 month' ELSE interval '1 year' END;
 INSERT INTO public.subscription_access(user_id,trial_started_at,trial_ends_at,trial_started_explicitly,subscription_ends_at)
 VALUES(purchase.user_id,now() - interval '2 microseconds',now() - interval '1 microsecond',false,deadline)
 ON CONFLICT (user_id) DO UPDATE SET subscription_ends_at = greatest(public.subscription_access.subscription_ends_at,excluded.subscription_ends_at);
 UPDATE public.payment_orders SET status = 'paid', razorpay_payment_id = _payment_id, paid_at = now(), access_until = deadline WHERE id = purchase.id RETURNING * INTO purchase;
 RETURN purchase;
END; $$;
REVOKE ALL ON FUNCTION public.complete_payment_order(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_payment_order(uuid,text) TO service_role;
COMMENT ON FUNCTION public.complete_payment_order(uuid,text) IS 'Service-only: call only after verifying the stored live Razorpay order and captured payment. Atomic and idempotent.';