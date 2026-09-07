-- GENERACIÓN DE CONTENIDO — el sistema del Centralizado (colaborador · gestión, celda «Líder»)
-- que convierte una IDEA DE VIDEO en los entregables con los que de verdad se graba.
--
-- La idea trae: tema, propósito social, propósito monetario, desarrollo del contenido,
-- referencia histórica (un trabajo real del grupo), fuentes de conocimiento (lo ya
-- clasificado en Gestión de Datos), talento y tonos de expresión. Con ese contexto el
-- agente devuelve seis entregables:
--   guion_largo  · YouTube, técnico y profundo
--   guion_corto  · TikTok, lenguaje para público general
--   short        · el recorte de ≤30 s del guion largo que engancha
--   carrusel     · las láminas de Instagram (intro → desarrollo → cierre), con su imagen IA
--   requerimientos · lo que hay que conseguir para rodar (vive SOLO en el panel derecho)
--   metadatos    · duración estimada por concepto, fuentes, referencias, tema…
--
-- ⚠️ PREFIJO: `gc_` YA ESTÁ OCUPADO por Gestión de Condiciones (gc_condiciones,
-- gc_requerimientos, gc_condicion_variables…). Este sistema usa **gcont_** para que no haya
-- dos dueños de un mismo prefijo — que es como se acaba borrando la tabla equivocada.

-- ── La idea ───────────────────────────────────────────────────────────────────────────
-- PRIVADA por colaborador: cada quien ve las suyas y el admin ve todas (decisión de
-- Fernando, 2026-09-06). Es el mismo alcance que Percepción Social, el otro sistema de
-- esta celda. `user_id` es TEXT porque `users.id` es UUID.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_contenidos (
  id                  SERIAL PRIMARY KEY,
  user_id             TEXT NOT NULL,
  member_id           BIGINT,
  titulo              TEXT,                       -- lo pone el agente al escribir el guion largo
  tema                TEXT NOT NULL,
  proposito_social    TEXT NOT NULL DEFAULT '',
  proposito_monetario TEXT NOT NULL DEFAULT '',
  desarrollo          TEXT NOT NULL DEFAULT '',
  talento             TEXT,
  estado              TEXT NOT NULL DEFAULT 'en_desarrollo',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gcont_contenidos_user_idx ON gcc_world.gcont_contenidos(user_id);
COMMENT ON COLUMN gcc_world.gcont_contenidos.estado IS
  'en_desarrollo | desarrollado | publicado | cancelado';

-- ── Referencia histórica ──────────────────────────────────────────────────────────────
-- Un trabajo REAL del grupo que el video cita: un producto, un proyecto o un ticket. Se
-- guarda el título en caché a propósito: si mañana se borra el proyecto, la ficha del video
-- tiene que seguir diciendo de qué hablaba, no quedarse muda.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_referencias (
  id           SERIAL PRIMARY KEY,
  contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,                     -- 'producto' | 'proyecto' | 'ticket'
  ref_id       BIGINT NOT NULL,
  titulo       TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contenido_id, tipo, ref_id)
);
CREATE INDEX IF NOT EXISTS gcont_referencias_cont_idx ON gcc_world.gcont_referencias(contenido_id);

-- ── Fuentes de conocimiento ───────────────────────────────────────────────────────────
-- Lo ya clasificado en Gestión de Datos. Se elige con casilla, en tabla y de SOLO LECTURA:
-- este sistema no edita la investigación de nadie. Misma razón para el caché de la
-- nomenclatura.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_fuentes (
  id           SERIAL PRIMARY KEY,
  contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,                     -- codigo|categoria|pieza|rompecabezas|subtema|tema
  ref_id       BIGINT NOT NULL,
  etiqueta     TEXT NOT NULL DEFAULT '',          -- nomenclatura o título, como se vio al elegir
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contenido_id, tipo, ref_id)
);
CREATE INDEX IF NOT EXISTS gcont_fuentes_cont_idx ON gcc_world.gcont_fuentes(contenido_id);

-- ── Tonos de expresión ────────────────────────────────────────────────────────────────
-- Varios a la vez, y esa es la gracia: con «triste» y «alegre» juntos el agente tiene que
-- encontrar la manera de integrarlos, no elegir uno. La lista de tonos es una LISTA GLOBAL
-- (gd_tonos, editable desde Encuadre Condiciológico) — aquí solo se guarda el texto elegido.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_tonos (
  id           SERIAL PRIMARY KEY,
  contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
  tono         TEXT NOT NULL,
  UNIQUE (contenido_id, tono)
);

-- ── Entregables ───────────────────────────────────────────────────────────────────────
-- Uno por tipo y contenido. `texto` para lo que se lee y se edita a mano (los guiones);
-- `datos` para lo que se pinta estructurado (requerimientos, metadatos, plan del carrusel).
-- `editado` marca que una persona lo tocó por encima de lo que escribió el agente: al
-- regenerar se avisa antes de pisarlo.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_entregables (
  id           SERIAL PRIMARY KEY,
  contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL,
  texto        TEXT NOT NULL DEFAULT '',
  datos        JSONB NOT NULL DEFAULT '{}'::jsonb,
  editado      BOOLEAN NOT NULL DEFAULT FALSE,
  generado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contenido_id, tipo)
);
COMMENT ON COLUMN gcc_world.gcont_entregables.tipo IS
  'guion_largo | guion_corto | short | carrusel | requerimientos | metadatos';

-- ── Láminas del carrusel de Instagram ─────────────────────────────────────────────────
-- Cuántas hacen falta lo decide el agente (la primera introduce, las de en medio
-- desarrollan, la última cierra), con un tope para que una idea no dispare veinte
-- llamadas de imagen. La imagen se genera lámina a lámina y se guarda su URL en
-- Cloudinary: en la fila NUNCA — esa lección ya se pagó con `projects.images`.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_laminas (
  id           SERIAL PRIMARY KEY,
  contenido_id INT NOT NULL REFERENCES gcc_world.gcont_contenidos(id) ON DELETE CASCADE,
  orden        INT NOT NULL DEFAULT 0,
  rol          TEXT NOT NULL DEFAULT 'desarrollo',  -- 'intro' | 'desarrollo' | 'cierre'
  titulo       TEXT NOT NULL DEFAULT '',
  texto        TEXT NOT NULL DEFAULT '',
  prompt_visual TEXT NOT NULL DEFAULT '',
  imagen_url   TEXT,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contenido_id, orden)
);
CREATE INDEX IF NOT EXISTS gcont_laminas_cont_idx ON gcc_world.gcont_laminas(contenido_id);

-- ── Los prompts, que son un DATO y no código ──────────────────────────────────────────
-- Fernando todavía no tiene los ejemplos de cómo debe escribir el agente; los irá afinando.
-- Por eso el botón de configuración edita ESTO, y no hace falta un despliegue para cambiar
-- la voz de un entregable. Mismo camino que ya tomó el Estudio del agente, donde
-- `prompt_perfil` y `prompt_reglas` son fuentes de origen `bd`.
-- El texto por defecto se siembra desde el código (PROMPTS_POR_DEFECTO) la primera vez.
CREATE TABLE IF NOT EXISTS gcc_world.gcont_prompts (
  clave      TEXT PRIMARY KEY,                    -- 'base' | <tipo de entregable>
  texto      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

-- ── Lista global de TONOS ─────────────────────────────────────────────────────────────
-- Vive con las demás listas globales (talentos, valores, situaciones, materias…) para que
-- Fernando la edite desde Encuadre Condiciológico sin tocar el repo.
CREATE TABLE IF NOT EXISTS gcc_world.gd_tonos (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
