-- ═══════════════════════════════════════════════════════════════════════════════
-- CADA TALENTO DE UN ÁMBITO LLEVA SU DESCRIPCIÓN        (2026-08-18, Fernando)
--
-- En `/ambitos`, al elegir un talento sale su nombre como titular y, debajo, esta
-- descripción. Se rellena al asociar el talento al ámbito, desde Admin → Ámbitos.
--
-- ── POR QUÉ CUELGA DE LA PAREJA Y NO DEL TALENTO ──────────────────────────────
-- El talento es del catálogo del grupo y lo comparte toda la app; la descripción es
-- **de cómo ese talento se ejerce DENTRO de este ámbito**. «Análisis de datos»
-- cuenta una cosa en Tecnología y otra en Investigación. Guardarla en el catálogo
-- obligaría a que las dos dijeran lo mismo — y el catálogo, además, vive en el
-- código, no en la base.
--
-- Nace nula: un talento asociado sin descripción es válido y en la web simplemente
-- no pinta el párrafo. Ni recuadro vacío ni «próximamente», como en el resto del
-- sitio.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE gcc_world.ambito_talentos
  ADD COLUMN IF NOT EXISTS descripcion TEXT;

COMMENT ON COLUMN gcc_world.ambito_talentos.descripcion IS
  'Cómo se ejerce este talento dentro de ESTE ámbito. Se publica en /ambitos bajo el título del talento. NULL = no se pinta.';
