-- ============================================================
-- Migración 033 — Agregar Tecate como ciudad operativa
-- Correr en: Supabase Dashboard > SQL Editor
-- ============================================================

alter type ciudad_enum add value if not exists 'tecate';
