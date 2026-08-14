-- ─────────────────────────────────────────────────────────────────────────────
-- CV PÚBLICO COMPARTIBLE POR TOKEN
--
-- ── QUÉ RESUELVE ──────────────────────────────────────────────────────────────
-- Un miembro genera un enlace y se lo pasa a un reclutador externo, que no tiene
-- cuenta en el sistema. Ese enlace enseña su CV completo: foto, datos, talentos con
-- su educación y experiencia, portafolio, disponibilidad laboral y aspiración
-- salarial. Se puede REGENERAR (mata el anterior) y REVOCAR.
--
-- ── POR QUÉ ES UN TOKEN Y NO EL id DEL MIEMBRO ────────────────────────────────
-- Antes existía `/members/<id>` — pública, sin token, y enseñaba nombre, foto,
-- teléfono, correo, CV y portafolio a cualquiera que escribiera un número del 1 al
-- 10. Con esa página viva, un token no protege nada: hay otra puerta abierta al
-- lado. Por eso esta migración llega **junto con la retirada de aquella ruta**.
-- El token es de 32 bytes (64 caracteres hex): no se adivina probando.
--
-- ── DÓNDE VIVE CADA COSA, Y POR QUÉ ───────────────────────────────────────────
-- · El TOKEN va en `members`, al lado de `calendar_public_token`, que es el mismo
--   mecanismo ya probado para el calendario público. Dos enlaces distintos, misma
--   forma; se revocan por separado a propósito.
-- · Lo demás va en `member_cv_profiles`, porque es CONTENIDO DEL CV. El formulario
--   de la aspiración salarial se ve en el panel de Perfil (lo pidió Fernando ahí),
--   pero el dato es del CV: si mañana el panel cambia, el dato no se muda.
--
-- ── LA DISPONIBILIDAD LABORAL NO ES EL HORARIO SEMANAL ────────────────────────
-- `member_schedules` guarda la franja de atención (Lun-Vie 09:00-17:00) y
-- `members.availability_status` dice si está conectado o fuera de casa. Ninguna de
-- las dos es lo que pregunta quien selecciona personal: cuándo puedes empezar, qué
-- jornada y si es remoto. Son campos nuevos, con prefijo `job_` para que nadie los
-- confunda con los otros dos.
--
-- ── CORREO Y TELÉFONO NO SE PUBLICAN POR OMISIÓN ──────────────────────────────
-- Un enlace se reenvía; un teléfono publicado no se despublica. `share_email` y
-- `share_phone` nacen en `false` y se encienden a mano.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. El token ───────────────────────────────────────────────────────────────
ALTER TABLE gcc_world.members
  ADD COLUMN IF NOT EXISTS cv_public_token            varchar(64),
  ADD COLUMN IF NOT EXISTS cv_public_token_created_at timestamptz;

-- Índice único PARCIAL: varios miembros pueden tener el token a NULL (nadie ha
-- compartido su CV) y eso no puede ser un choque de unicidad.
CREATE UNIQUE INDEX IF NOT EXISTS members_cv_public_token_uidx
  ON gcc_world.members (cv_public_token)
  WHERE cv_public_token IS NOT NULL;

COMMENT ON COLUMN gcc_world.members.cv_public_token IS
  'Enlace público del CV (/cv/<token>). 32 bytes hex. NULL = no compartido. Regenerar mata el anterior.';

-- ── 2. Contenido nuevo del CV ─────────────────────────────────────────────────
ALTER TABLE gcc_world.member_cv_profiles
  -- Presentación
  ADD COLUMN IF NOT EXISTS headline        text,
  ADD COLUMN IF NOT EXISTS location        text,
  -- Aspiración salarial: rango MENSUAL en USD (decisión de Fernando, 2026-08-14).
  -- Sin columna de periodo a propósito: una sola unidad no se malinterpreta.
  ADD COLUMN IF NOT EXISTS salary_min      numeric(12,2),
  ADD COLUMN IF NOT EXISTS salary_max      numeric(12,2),
  ADD COLUMN IF NOT EXISTS salary_visible  boolean NOT NULL DEFAULT true,
  -- Disponibilidad laboral
  ADD COLUMN IF NOT EXISTS job_status      varchar(20) NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS job_available_from date,
  ADD COLUMN IF NOT EXISTS job_workday     varchar(20) NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS job_mode        varchar(20) NOT NULL DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS job_note        text,
  -- Qué datos de contacto salen a la página pública
  ADD COLUMN IF NOT EXISTS share_email     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_phone     boolean NOT NULL DEFAULT false;

-- Los CHECK no admiten IF NOT EXISTS: se añaden solo si faltan, para que la
-- migración se pueda volver a pasar sin reventar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_cv_job_status_chk') THEN
    ALTER TABLE gcc_world.member_cv_profiles
      ADD CONSTRAINT member_cv_job_status_chk
      CHECK (job_status IN ('immediate', 'from_date', 'not_available'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_cv_job_workday_chk') THEN
    ALTER TABLE gcc_world.member_cv_profiles
      ADD CONSTRAINT member_cv_job_workday_chk
      CHECK (job_workday IN ('full', 'part', 'both'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_cv_job_mode_chk') THEN
    ALTER TABLE gcc_world.member_cv_profiles
      ADD CONSTRAINT member_cv_job_mode_chk
      CHECK (job_mode IN ('remote', 'hybrid', 'onsite', 'any'));
  END IF;

  -- Un rango invertido (mínimo mayor que el máximo) no es un dato, es un error de
  -- captura. Se corta en la base y no solo en el formulario.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'member_cv_salary_rango_chk') THEN
    ALTER TABLE gcc_world.member_cv_profiles
      ADD CONSTRAINT member_cv_salary_rango_chk
      CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max);
  END IF;
END $$;

COMMENT ON COLUMN gcc_world.member_cv_profiles.salary_min IS
  'Aspiración salarial MENSUAL en USD, extremo inferior del rango. NULL = no declarada.';
COMMENT ON COLUMN gcc_world.member_cv_profiles.job_status IS
  'Disponibilidad LABORAL: immediate | from_date | not_available. No confundir con members.availability_status (conectado/fuera de casa) ni con member_schedules (horario de atención).';
COMMENT ON COLUMN gcc_world.member_cv_profiles.share_phone IS
  'Si el teléfono sale en el CV público. Nace apagado: un enlace se reenvía y un teléfono publicado no se despublica.';
