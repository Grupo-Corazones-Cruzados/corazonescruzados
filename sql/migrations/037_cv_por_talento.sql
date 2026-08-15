-- ─────────────────────────────────────────────────────────────────────────────
-- EL CV PASA A ORGANIZARSE POR TALENTO
--
-- ── EL CAMBIO DE FONDO ────────────────────────────────────────────────────────
-- Hasta ahora el CV era uno solo, con los talentos dentro. A partir de aquí **el
-- talento es el eje**: quien abre el enlace ve el CV de UN talento —«Automatización
-- de procesos», «Psicología»— y puede cambiar al otro. Decisión de Fernando
-- (2026-08-15), y es la que hace que un mismo miembro pueda presentarse ante una
-- empresa de tecnología y ante una de salud mental sin mezclar las dos cosas.
--
-- ── DE DÓNDE SALE QUE UN PROYECTO ES DE UN TALENTO ────────────────────────────
-- No hace falta inventar una tabla: **ya está en los requerimientos**. Al crear un
-- proyecto, cada requerimiento declara los talentos que necesita, y eso es lo que
-- decide qué miembro puede tomarlo. Así que un proyecto pertenece a un talento si
-- **alguno de sus requerimientos pide ese talento**. Se consulta al vuelo; no se
-- duplica el dato.
--
-- Lo que sí necesitaba columna es el portafolio **escrito a mano**
-- (`member_portfolio_items`): un producto o una automatización que alguien añade no
-- pasa por requerimientos, así que su talento hay que decirlo.
--
-- ── LO QUE SE VA ──────────────────────────────────────────────────────────────
-- · `headline` (titular profesional): lo sustituye **el nombre del talento**, que es
--   más honesto — el titular era una frase suelta que había que mantener a mano y
--   que además contradecía al CV cuando se miraba el otro talento.
-- · `skills` global: **las skills pasan a ser de cada talento**. Son referencias de
--   lo que se sabe hacer *con ese talento*; una lista única mezclaba «Power
--   Platform» con lo que se usa en psicología.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. El portafolio escrito a mano declara su talento ────────────────────────
ALTER TABLE gcc_world.member_portfolio_items
  ADD COLUMN IF NOT EXISTS talent text;

COMMENT ON COLUMN gcc_world.member_portfolio_items.talent IS
  'Talento del miembro al que pertenece este ítem. Los PROYECTOS de la app no lo necesitan: su talento sale de los talentos de sus requerimientos.';

-- Todo lo que ya existía es de automatización de procesos (Fernando, 2026-08-15).
UPDATE gcc_world.member_portfolio_items
   SET talent = 'Automatización de procesos'
 WHERE talent IS NULL;

-- ── 2. Las skills se reparten por talento, dentro de `talents` ────────────────
-- Se cuelgan del PRIMER talento, que es de donde salieron: la lista actual describe
-- lo que hace con automatización de procesos. Si hubiera que repartirlas de otro
-- modo, se hace desde la pantalla, que para eso ahora tiene su sección.
UPDATE gcc_world.member_cv_profiles p
   SET talents = (
     SELECT jsonb_agg(
       CASE WHEN t.ord = 1
            THEN t.valor || jsonb_build_object('skills', to_jsonb(COALESCE(p.skills, '{}')))
            ELSE t.valor || jsonb_build_object('skills', '[]'::jsonb)
       END ORDER BY t.ord)
     FROM jsonb_array_elements(p.talents) WITH ORDINALITY AS t(valor, ord)
   )
 WHERE talents IS NOT NULL
   AND jsonb_array_length(talents) > 0;

-- ── 3. Fuera lo que ya no se usa ──────────────────────────────────────────────
ALTER TABLE gcc_world.member_cv_profiles
  DROP COLUMN IF EXISTS headline,
  DROP COLUMN IF EXISTS skills;

COMMENT ON COLUMN gcc_world.member_cv_profiles.talents IS
  'Talentos del miembro: [{key, education[], experience[], skills[]}]. El talento es el eje del CV público: cada uno tiene su trayectoria, sus skills, sus servicios y su portafolio.';
