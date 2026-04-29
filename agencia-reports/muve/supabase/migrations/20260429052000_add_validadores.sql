-- IMPORTANTE: María debe ejecutar esta migración manualmente
-- en Supabase Dashboard → SQL Editor antes de probar el código

CREATE TABLE IF NOT EXISTS validadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  ultima_actividad TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validadores_negocio ON validadores(negocio_id);
CREATE INDEX IF NOT EXISTS idx_validadores_activo ON validadores(activo);
CREATE INDEX IF NOT EXISTS idx_visitas_validado_por ON visitas(validado_por);

ALTER TABLE validadores ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validadores'
      AND policyname = 'staff y admin leen validadores'
  ) THEN
    CREATE POLICY "staff y admin leen validadores" ON validadores
      FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = auth.uid()
            AND (
              u.rol = 'admin'
              OR (u.rol = 'staff' AND u.negocio_id = validadores.negocio_id)
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'validadores'
      AND policyname = 'staff y admin gestionan validadores'
  ) THEN
    CREATE POLICY "staff y admin gestionan validadores" ON validadores
      FOR ALL USING (
        EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = auth.uid()
            AND (
              u.rol = 'admin'
              OR (u.rol = 'staff' AND u.negocio_id = validadores.negocio_id)
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM users u
          WHERE u.id = auth.uid()
            AND (
              u.rol = 'admin'
              OR (u.rol = 'staff' AND u.negocio_id = validadores.negocio_id)
            )
        )
      );
  END IF;
END
$$;
