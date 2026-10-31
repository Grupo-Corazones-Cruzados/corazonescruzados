-- ═══════════════════════════════════════════════════════════════════════════════
-- CADA TALENTO DE UNA SOLUCIÓN LLEVA SU ICONO              (2026-10-31, Fernando)
--
-- Textual: *«cada talento con un ícono que me gustaría establezcas a nivel de tabla que
-- cada talento tenga su icono»*. La lista de soluciones de Clientes enseña sus talentos
-- como enseñaba los Productos y Servicios asociados: icono + nombre.
--
-- Es una CLAVE del mapa `ICONOS` (`components/sitio/piezas.tsx`), igual que el icono de
-- los conceptos (migración 045): se elige viéndolo en Admin → Soluciones. Sin icono, la web
-- pinta el de por defecto; por eso puede ser NULL.
--
-- Al único talento que hay hoy se le da uno para que la web no salga con el genérico;
-- Fernando lo cambia en Admin si prefiere otro.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE gcc_world.solucion_talentos ADD COLUMN IF NOT EXISTS icono TEXT;

UPDATE gcc_world.solucion_talentos
   SET icono = 'flujo'
 WHERE talento = 'Automatización de procesos' AND icono IS NULL;
