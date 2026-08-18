-- ═══════════════════════════════════════════════════════════════════════════════
-- LOS CONCEPTOS DE UNA SOLUCIÓN                          (2026-08-18, Fernando)
--
-- Cada solución puede llevar un conjunto de **conceptos**: título, icono y
-- descripción. Se publican en `/soluciones` como una **tira vertical en el panel
-- derecho** — el mismo carrusel que tenía la galería de Automatización, girado.
--
-- ── DE DÓNDE SALEN LOS PRIMEROS ONCE ──────────────────────────────────────────
-- Son las once tarjetas que vivían en la galería de `/negocio/automatizacion`,
-- escritas por Fernando el 2026-08-06. Al retirar aquella puerta (2026-08-18) su
-- texto quedó solo en el historial; esta migración lo devuelve a la vida como datos
-- editables desde Admin → Soluciones, que era el objetivo: *«que queden registrados
-- en esta sección de conceptos nueva, y con su icono asociado también»*.
--
-- Se recuperan `titulo`, `icono` y el texto CORTO de la tarjeta. La descripción
-- larga y la lista de beneficios de cada una **no se traen**: el carrusel enseña una
-- frase, y meter tres párrafos en una tira que se desliza no se lee. Siguen en
-- `git show 61a7037:lib/sitio/contenido.ts` por si algún día hacen falta.
--
-- ── EL ICONO ES UN NOMBRE, NO UN ARCHIVO ──────────────────────────────────────
-- Guarda la clave del mapa `ICONOS` (`components/sitio/piezas.tsx`) — `robot`,
-- `nube`, `base-datos`—, no una imagen ni un SVG. Así el icono se pinta con la
-- librería que ya usa todo el sitio, pesa cero y cambia de color con el tema.
-- ⚠️ Si se borra una clave de ese mapa, el concepto que la usara cae al icono por
-- defecto en vez de romperse.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gcc_world.solucion_conceptos (
  id          BIGSERIAL PRIMARY KEY,
  solucion_id BIGINT      NOT NULL REFERENCES gcc_world.soluciones(id) ON DELETE CASCADE,

  titulo      TEXT        NOT NULL,
  /** Clave del mapa ICONOS. Ver el aviso de arriba. */
  icono       VARCHAR(40) NOT NULL DEFAULT 'capas',
  descripcion TEXT,

  -- Orden manual dentro de su solución, como las FAQs y los talentos: se ordena por
  -- esta columna y, a igualdad, por `id`, para que dos conceptos con el mismo número
  -- nunca bailen entre recargas.
  orden       INTEGER     NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solucion_conceptos_solucion_idx
  ON gcc_world.solucion_conceptos (solucion_id, orden, id);

COMMENT ON TABLE gcc_world.solucion_conceptos IS
  'Conceptos de una solución: título, icono y descripción. Se publican en /soluciones como tira vertical. Se editan en Admin → Soluciones.';

-- ── Los once de Automatización, a la solución que los tenga (si existe alguna) ──
-- Se insertan en la PRIMERA solución por orden. Si aún no hay ninguna, la migración
-- no falla: simplemente no inserta nada y los conceptos se crean a mano.
INSERT INTO gcc_world.solucion_conceptos (solucion_id, titulo, icono, descripcion, orden)
SELECT s.id, v.titulo, v.icono, v.descripcion, v.orden
  FROM (SELECT id FROM gcc_world.soluciones ORDER BY orden, id LIMIT 1) s,
       (VALUES
         ('Aplicaciones Empresariales', 'aplicacion',
          'El sistema con el que tu empresa trabaja de verdad, construido sobre vuestra operación y no sobre un producto cerrado.', 0),
         ('Robots Automatizados', 'robot',
          'Tareas repetitivas que se ejecutan solas: capturan, comparan y registran sin que nadie tenga que estar delante.', 1),
         ('Intranets', 'red',
          'El sitio interno donde tu equipo encuentra lo que necesita, sin preguntar por correo.', 2),
         ('Bases de Datos', 'base-datos',
          'Diseño, migración y puesta a punto del sitio donde vive tu información.', 3),
         ('Máquinas Virtuales para Desktop y Móvil', 'pantallas',
          'Entornos aislados que se levantan cuando hacen falta: para probar, para automatizar o para trabajar sin tocar el equipo de nadie.', 4),
         ('Agentes de IA o Conversacionales', 'agente',
          'Atención que responde con el conocimiento de tu negocio y pasa a una persona en cuanto hace falta.', 5),
         ('Sitios Web', 'web',
          'La cara pública de tu negocio, hecha para que se encuentre en las búsquedas y para que cargue rápido.', 6),
         ('ERP Modular', 'modulos',
          'Compras, inventario, facturación o nómina: se enciende lo que hace falta y se amplía después.', 7),
         ('Integraciones Tecnológicas', 'integracion',
          'Que tus sistemas se hablen entre ellos, para dejar de teclear lo mismo dos veces.', 8),
         ('Administración de Inquilinos', 'inquilinos',
          'Varias empresas o sedes sobre un mismo sistema, cada una con lo suyo separado.', 9),
         ('Administración de Recursos de Azure o multi-nube', 'nube',
          'Servidores, respaldos y costos bajo control, en Azure o repartidos entre varias nubes.', 10)
       ) AS v(titulo, icono, descripcion, orden)
 WHERE NOT EXISTS (SELECT 1 FROM gcc_world.solucion_conceptos);
