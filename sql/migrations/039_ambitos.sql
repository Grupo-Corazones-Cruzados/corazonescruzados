-- ═══════════════════════════════════════════════════════════════════════════════
-- ÁMBITOS — los tipos de proyecto que el grupo es capaz de manejar
--                                                        (2026-08-18, Fernando)
--
-- Alimentan la página pública `/ambitos`: un panel izquierdo con carpetas
-- desplegables —un ámbito, y dentro sus talentos— y, al elegir un talento, los
-- proyectos y tickets terminados que se hicieron con él.
--
-- ── LO QUE NO HACE FALTA CREAR, Y ES LA MITAD DEL DISEÑO ──────────────────────
-- La cadena «ámbito → talento → trabajo hecho» **ya existe entera** salvo el primer
-- eslabón:
--   · un PROYECTO pertenece a un talento si alguno de sus requerimientos lo pide
--     (`project_requirements.talents`, con índice GIN) — la misma regla que usa el
--     CV público desde la migración 037;
--   · un TICKET lo declara en `tickets.required_talents`.
-- Así que aquí solo nacen los ÁMBITOS y su relación con los talentos. Nada de
-- copiar a qué ámbito pertenece un proyecto: se consulta al vuelo y no puede
-- desincronizarse.
--
-- ── POR QUÉ EL TALENTO ES TEXTO Y NO UNA CLAVE FORÁNEA ────────────────────────
-- El catálogo de talentos vive en el CÓDIGO (`lib/centralized/talentos.ts`), no en
-- la base — igual que las cinco puertas de `/soluciones`. Meterlo también aquí
-- obligaría a mantener dos listas sincronizadas, que es exactamente como se
-- desincronizan. Es la misma decisión, y por el mismo motivo, que `faqs.acceso_id`
-- en la migración 033.
--
-- ⚠️ Consecuencia asumida: si algún día se renombra un talento en el catálogo, las
-- filas que lo nombran quedan huérfanas. El panel del admin las marca en vez de
-- esconderlas, para que se vean y se arreglen.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gcc_world.ambitos (
  id         BIGSERIAL PRIMARY KEY,

  nombre     TEXT        NOT NULL,

  -- El tramo que identifica al ámbito en la web: `/ambitos#tecnologia`. Se guarda y
  -- no se recalcula al vuelo porque **es una URL**: si se derivara del nombre, al
  -- corregir una tilde se romperían los enlaces que ya circulen.
  slug       VARCHAR(80) NOT NULL UNIQUE,

  -- Orden manual en el panel izquierdo. Mismo criterio que las FAQs (migración 033):
  -- se ordena por esta columna y, a igualdad, por `id`, para que dos ámbitos con el
  -- mismo número nunca bailen entre recargas.
  orden      INTEGER     NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE gcc_world.ambitos IS
  'Tipos de proyecto que maneja el grupo. Se editan en Admin → Ámbitos y se publican en /ambitos.';

-- ── Los talentos de cada ámbito ───────────────────────────────────────────────
-- Un ámbito tiene varios talentos, y un talento PUEDE estar en más de un ámbito a
-- propósito: «Análisis de datos» cabe en Tecnología y en Investigación, y en la web
-- aparecerá bajo las dos carpetas, que es lo correcto.
CREATE TABLE IF NOT EXISTS gcc_world.ambito_talentos (
  ambito_id  BIGINT      NOT NULL REFERENCES gcc_world.ambitos(id) ON DELETE CASCADE,
  talento    TEXT        NOT NULL,
  orden      INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ambito_id, talento)
);

COMMENT ON COLUMN gcc_world.ambito_talentos.talento IS
  'Nombre EXACTO del catálogo de lib/centralized/talentos.ts. Texto y no FK: el catálogo vive en el código.';

-- Buscar «qué ámbitos contienen este talento» es la consulta de la página pública.
CREATE INDEX IF NOT EXISTS ambito_talentos_talento_idx
  ON gcc_world.ambito_talentos (talento);

CREATE INDEX IF NOT EXISTS ambitos_orden_idx ON gcc_world.ambitos (orden, id);
