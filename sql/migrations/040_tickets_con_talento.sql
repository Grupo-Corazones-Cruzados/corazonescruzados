-- ═══════════════════════════════════════════════════════════════════════════════
-- TODO TICKET DECLARA SU TALENTO                          (2026-08-18, Fernando)
--
-- ── POR QUÉ ───────────────────────────────────────────────────────────────────
-- La página `/ambitos` enseña, por talento, los proyectos y tickets terminados que
-- se hicieron con él. Los proyectos ya lo declaran —vía los talentos de sus
-- requerimientos—, pero los tickets **no**: `required_talents` solo se rellenaba
-- cuando el ticket se abría «por talento», que es uno de tres caminos posibles.
--
-- Medido antes de tocar nada, contra producción: de los **19 tickets terminados,
-- los 19 tenían la lista VACÍA**. La mitad «tickets» de la página habría salido
-- siempre vacía, y nadie habría entendido por qué.
--
-- ── EL CAMPO CAMBIA DE OFICIO, Y CONVIENE SABERLO ─────────────────────────────
-- `required_talents` nació para decidir **quién puede tomar** un ticket abierto.
-- A partir de ahora hace además de **clasificación**: es lo que coloca al ticket
-- bajo un ámbito. Por eso pasa a pedirse SIEMPRE, también cuando el ticket se
-- asigna a dedo o se abre a propuestas, donde antes no tenía sentido preguntarlo.
--
-- ── LO QUE HACE ESTA MIGRACIÓN ────────────────────────────────────────────────
-- Etiqueta lo que ya existe con «Automatización de procesos», que es lo que
-- Fernando indicó y lo que además cuadra con la realidad: es el talento de 11 de
-- los 11 proyectos terminados.
--
-- ⚠️ Solo toca las filas con la lista VACÍA o nula. Un ticket que ya declaraba sus
-- talentos no se pisa: eso sería inventar un dato encima de uno bueno.
-- ═══════════════════════════════════════════════════════════════════════════════

-- La columna se creaba a mano desde el código (`ALTER TABLE … IF NOT EXISTS` en cada
-- POST). Se asegura aquí para que la migración no dependa de que alguien haya
-- llamado antes al endpoint.
ALTER TABLE gcc_world.tickets
  ADD COLUMN IF NOT EXISTS required_talents TEXT[] DEFAULT '{}';

UPDATE gcc_world.tickets
   SET required_talents = ARRAY['Automatización de procesos'],
       updated_at       = NOW()
 WHERE required_talents IS NULL
    OR cardinality(required_talents) = 0;

COMMENT ON COLUMN gcc_world.tickets.required_talents IS
  'Talentos del ticket. Dos oficios: deciden QUIÉN puede tomarlo si está abierto por talento, y CLASIFICAN el ticket para /ambitos. Obligatorio al crear desde 2026-08-18.';

-- El filtro de la página pública es «dame los tickets de este talento»: sin índice,
-- recorre la tabla entera por cada carpeta que se abra.
CREATE INDEX IF NOT EXISTS tickets_required_talents_idx
  ON gcc_world.tickets USING GIN (required_talents);
