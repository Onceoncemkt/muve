ALTER TABLE negocios
ADD COLUMN nivel TEXT NOT NULL DEFAULT 'basico'
CHECK (nivel IN ('basico', 'plus', 'total'));
