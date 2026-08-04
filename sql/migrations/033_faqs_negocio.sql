-- ═══════════════════════════════════════════════════════════════════════════════
-- PREGUNTAS FRECUENTES DE LAS PÁGINAS DE /negocio          (2026-08-04, Fernando)
--
-- Cada una de las cinco puertas de `/negocio` —requerimientos, automatizacion,
-- videojuego, marketplace, votacion— tiene su propia lista de preguntas, que se
-- redactan desde Admin → FAQs y se publican en su página.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE: de aquí sale el bloque `FAQPage` de datos
-- estructurados, que es el formato que Google convierte en respuestas desplegables
-- dentro de sus resultados. Es la pieza con más potencial de todo el trabajo de
-- posicionamiento del sitio.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gcc_world.faqs (
  id          BIGSERIAL PRIMARY KEY,

  -- El tramo de la URL: `/negocio/<acceso_id>`. Es texto y NO una clave foránea a
  -- propósito: las cinco puertas viven en el código (`ACCESOS`, en
  -- `lib/sitio/contenido.ts`), no en la base. Meterlas también aquí obligaría a
  -- mantenerlas sincronizadas en dos sitios, que es justo como se desincronizan.
  acceso_id   VARCHAR(50)  NOT NULL,

  pregunta    TEXT         NOT NULL,
  respuesta   TEXT         NOT NULL,

  -- Orden manual dentro de su página (Fernando, 2026-08-04: «una columna en la tabla
  -- de faqs para establecer el orden»). Se ordena por esta columna y, a igualdad, por
  -- `id`, para que dos preguntas con el mismo número nunca bailen entre recargas.
  orden       INTEGER      NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- La consulta de la web pública es siempre «dame las de esta puerta, en su orden».
CREATE INDEX IF NOT EXISTS faqs_acceso_orden_idx
  ON gcc_world.faqs (acceso_id, orden, id);
