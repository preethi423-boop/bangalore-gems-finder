CREATE TABLE public.google_maps_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
 browser_key text NOT NULL DEFAULT '',
 server_key text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE ON public.google_maps_settings TO authenticated;
GRANT ALL ON public.google_maps_settings TO service_role;
ALTER TABLE public.google_maps_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators manage Google Maps settings" ON public.google_maps_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
