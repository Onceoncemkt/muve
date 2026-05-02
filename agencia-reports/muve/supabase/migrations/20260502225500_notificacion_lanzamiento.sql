-- IMPORTANTE: María debe ejecutar manualmente

-- Agregar campo de expiración del código
ALTER TABLE preregistros
ADD COLUMN IF NOT EXISTS codigo_expira_at TIMESTAMPTZ;

-- Índices para queries de notificación
CREATE INDEX IF NOT EXISTS idx_preregistros_notif
ON preregistros(ciudad, estado, notificado_lanzamiento_at);

CREATE INDEX IF NOT EXISTS idx_preregistros_expira
ON preregistros(codigo_expira_at);
