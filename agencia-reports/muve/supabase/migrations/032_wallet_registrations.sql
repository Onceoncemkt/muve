-- Registros que Apple Wallet/Google Wallet usan para mandar push updates al
-- dispositivo cuando los créditos o el plan del usuario cambian.
CREATE TABLE IF NOT EXISTS public.wallet_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  device_library_id text NOT NULL,
  push_token text NOT NULL,
  pass_type_id text NOT NULL,
  serial_number text NOT NULL,
  authentication_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (device_library_id, pass_type_id, serial_number)
);

CREATE INDEX IF NOT EXISTS wallet_registrations_user_id_idx
  ON public.wallet_registrations (user_id);

CREATE INDEX IF NOT EXISTS wallet_registrations_pass_serial_idx
  ON public.wallet_registrations (pass_type_id, serial_number);
