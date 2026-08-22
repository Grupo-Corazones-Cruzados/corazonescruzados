-- ═══════════════════════════════════════════════════════════════════════════════
-- LOS CONCEPTOS CUELGAN DEL TALENTO, NO DE LA SOLUCIÓN     (2026-08-21, Fernando)
--
-- Textual: *«la vista de conceptos realmente debe estar asociada a un talento
-- determinado, todos los conceptos actuales están directamente relacionados al
-- concepto de automatización de procesos»*.
--
-- ── CORRIGE LA MIGRACIÓN 045, QUE LOS COLGÓ DE LA SOLUCIÓN ────────────────────
-- Allí quedó escrito que los conceptos «describen lo que sabe hacer la solución
-- entera, no una de sus especialidades». Era falso, y se veía en los datos: los
-- once conceptos de «Tecnología» —Robots Automatizados, ERP Modular, Sitios Web…—
-- son todos formas de ejercer **Automatización de procesos**, que es el único
-- talento de esa solución. Si mañana entra «Análisis de datos» bajo la misma
-- solución, la tira le enseñaría once conceptos que no son suyos.
--
-- Es la misma lógica que ya rige la DESCRIPCIÓN desde la migración 041: lo que
-- cuenta CÓMO se trabaja cuelga del talento dentro de su solución, no del cajón.
--
-- ── POR QUÉ LA CLAVE ES EL TEXTO DEL TALENTO Y NO UN id ───────────────────────
-- `gcc_world.solucion_talentos` no tiene columna `id`: su clave es
-- `(solucion_id, talento)`. Pero `talento` es ÚNICO en toda la tabla desde la
-- migración 042 —un talento pertenece a una sola solución—, y ese índice único
-- (`solucion_talentos_talento_unico`) basta para colgar de él una clave foránea.
-- Comprobado contra la base real antes de escribir esto, en una transacción
-- revertida: PostgreSQL acepta la FK contra el índice único.
--
-- ── `solucion_id` SE VA, NO SE QUEDA «POR SI ACASO» ───────────────────────────
-- La solución del concepto se sabe siguiendo su talento. Guardarla otra vez aquí
-- es el dato duplicado que un día deja de cuadrar (la misma razón por la que el
-- enganche con proyectos y tickets se consulta y no se guarda).
--
-- ⚠️ CONSECUENCIA ASUMIDA: quitarle un talento a una solución **se lleva sus
-- conceptos** (ON DELETE CASCADE). Por eso el admin pide confirmación diciendo
-- cuántos se van, y por eso `fijarTalentos()` pasó a guardar por diferencias en
-- vez de borrar la lista entera y reinsertarla: con el borrado en bloque, cada
-- guardado de talentos habría vaciado los conceptos de todos.
--
-- ── LOS DATOS DE HOY (leídos, no supuestos) ───────────────────────────────────
-- 1 solución (Tecnología, id 5) · 1 talento (Automatización de procesos) ·
-- 11 conceptos, todos de esa solución. El reparto es exacto: los 11 van al único
-- talento que existe.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE gcc_world.solucion_conceptos
  ADD COLUMN IF NOT EXISTS talento TEXT;

-- Cada concepto se va al PRIMER talento de su solución (por orden, y a igualdad
-- por nombre). Con los datos de hoy no hay ambigüedad: solo hay uno.
UPDATE gcc_world.solucion_conceptos c
   SET talento = (SELECT t.talento
                    FROM gcc_world.solucion_talentos t
                   WHERE t.solucion_id = c.solucion_id
                   ORDER BY t.orden, t.talento
                   LIMIT 1)
 WHERE c.talento IS NULL;

-- Un concepto de una solución SIN talentos no tiene dónde colgarse. Hoy no hay
-- ninguno (verificado); si lo hubiera, quedarse sería quedarse huérfano e
-- invisible, porque la web solo pinta la tira del talento abierto.
DELETE FROM gcc_world.solucion_conceptos WHERE talento IS NULL;

ALTER TABLE gcc_world.solucion_conceptos
  ALTER COLUMN talento SET NOT NULL;

ALTER TABLE gcc_world.solucion_conceptos
  DROP CONSTRAINT IF EXISTS solucion_conceptos_talento_fkey;
ALTER TABLE gcc_world.solucion_conceptos
  ADD CONSTRAINT solucion_conceptos_talento_fkey
  FOREIGN KEY (talento) REFERENCES gcc_world.solucion_talentos (talento)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- El índice que sirve la consulta de siempre: «los conceptos de este talento, en
-- su orden». Sustituye al que iba por solución.
DROP INDEX IF EXISTS gcc_world.solucion_conceptos_solucion_idx;
CREATE INDEX IF NOT EXISTS solucion_conceptos_talento_idx
  ON gcc_world.solucion_conceptos (talento, orden, id);

ALTER TABLE gcc_world.solucion_conceptos
  DROP COLUMN IF EXISTS solucion_id;

COMMENT ON COLUMN gcc_world.solucion_conceptos.talento IS
  'El talento al que pertenece el concepto (texto exacto del catálogo). Único en solucion_talentos desde la migración 042, por eso puede ser clave foránea.';
COMMENT ON TABLE gcc_world.solucion_conceptos IS
  'Conceptos de un TALENTO: título, icono y descripción. Se publican en /soluciones como la tira vertical del talento abierto. Se editan en Admin → Soluciones, dentro del panel del talento.';
