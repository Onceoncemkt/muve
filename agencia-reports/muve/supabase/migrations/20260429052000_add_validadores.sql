-- IMPORTANTE: María debe ejecutar esta migración manualmente
-- en Supabase Dashboard → SQL Editor antes de probar el código

CREATE TABLE validadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  ultima_actividad TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_validadores_negocio ON validadores(negocio_id);
CREATE INDEX idx_validadores_activo ON validadores(activo);

ALTER TABLE check_ins
ADD COLUMN validado_por UUID REFERENCES validadores(id);

CREATE INDEX idx_check_ins_validado_por ON check_ins(validado_por);
