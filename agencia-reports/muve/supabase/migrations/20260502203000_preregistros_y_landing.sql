-- IMPORTANTE: María debe ejecutar manualmente

-- Tabla de pre-registros
CREATE TABLE preregistros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  ciudad TEXT NOT NULL,
  nombre TEXT,
  codigo_descuento TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'convertido', 'cancelado')),
  user_id UUID REFERENCES users(id),
  story_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notificado_lanzamiento_at TIMESTAMPTZ,
  convertido_at TIMESTAMPTZ
);

CREATE INDEX idx_preregistros_email ON preregistros(email);
CREATE INDEX idx_preregistros_ciudad ON preregistros(ciudad);
CREATE INDEX idx_preregistros_estado ON preregistros(estado);
CREATE INDEX idx_preregistros_codigo ON preregistros(codigo_descuento);

-- Campos para landing en negocios
ALTER TABLE negocios
ADD COLUMN logo_url TEXT;

ALTER TABLE negocios
ADD COLUMN mostrar_en_landing BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_negocios_landing ON negocios(mostrar_en_landing);
