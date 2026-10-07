-- ─────────────────────────────────────────────────────────────────────────────
-- 070 · El ticket admite el estado 'draft' (borrador) (2026-10-07)
-- ─────────────────────────────────────────────────────────────────────────────
-- 069 daba por hecho que `tickets.status` no tenía CHECK; SÍ lo tiene (`tickets_status_check`,
-- solo vivía en la base). Se rehace igual que estaba, añadiendo 'draft'.
ALTER TABLE gcc_world.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE gcc_world.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('draft', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'withdrawn'));
