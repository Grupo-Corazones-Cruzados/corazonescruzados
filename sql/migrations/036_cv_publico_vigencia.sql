-- ─────────────────────────────────────────────────────────────────────────────
-- EL ENLACE DEL CV CADUCA · Y FUERA LOS INTERRUPTORES QUE SOBRABAN
--
-- ── 1. VIGENCIA ───────────────────────────────────────────────────────────────
-- Decisión de Fernando (2026-08-14): compartir el CV se hace como compartir una
-- cotización — el mismo diálogo, con **acceso temporal**. Un currículum con datos
-- personales que queda accesible para siempre porque nadie se acordó de revocarlo es
-- el fallo por omisión de este tipo de enlaces.
--
-- `NULL` = sin caducidad, que sigue siendo una opción legítima y explícita.
--
-- ── 2. LOS INTERRUPTORES QUE SE VAN ───────────────────────────────────────────
-- Textual: *«quita eso de mostrar el rango en el cv público, eso que no exista
-- porque si el usuario no ingresa esos valores es porque no quiere mostrar ese
-- campo»* y *«quita el alternar de publicar mi correo y teléfono eso va porque va»*.
--
-- Tiene razón y es una regla de diseño, no un capricho: **el campo vacío YA es el
-- interruptor**. Un dato que se rellena y luego se oculta con una casilla aparte son
-- dos formas de decir lo mismo, y la segunda hay que descubrirla.
--
-- ⚠️ Consecuencia asumida: **el correo y el teléfono del miembro se publican
-- siempre** en el CV compartido. Quien no quiera publicarlos, no comparte el CV —o
-- lo revoca. Es lo que pidió, y ahora el enlace caduca solo, que compensa.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gcc_world.members
  ADD COLUMN IF NOT EXISTS cv_public_token_expires_at timestamptz;

COMMENT ON COLUMN gcc_world.members.cv_public_token_expires_at IS
  'Caducidad del enlace público del CV. NULL = sin caducidad. Pasada la fecha, miembroDeToken() devuelve null y las cuatro puertas dan 404.';

ALTER TABLE gcc_world.member_cv_profiles
  DROP COLUMN IF EXISTS salary_visible,
  DROP COLUMN IF EXISTS share_email,
  DROP COLUMN IF EXISTS share_phone;
