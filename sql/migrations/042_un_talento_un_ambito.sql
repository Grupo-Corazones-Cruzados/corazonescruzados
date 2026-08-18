-- ═══════════════════════════════════════════════════════════════════════════════
-- UN TALENTO PERTENECE A UN SOLO ÁMBITO                  (2026-08-18, Fernando)
--
-- ── CORRIGE UNA DECISIÓN MÍA, NO UN OLVIDO ────────────────────────────────────
-- La migración 039 dejó la clave primaria en `(ambito_id, talento)` **a propósito**,
-- con este comentario escrito: *«un talento PUEDE estar en más de un ámbito a
-- propósito: "Análisis de datos" cabe en Tecnología y en Investigación, y en la web
-- aparecerá bajo las dos carpetas, que es lo correcto»*.
--
-- Era falso. Fernando: *«un talento no puede existir en más de un ámbito»*. El
-- ámbito **clasifica** el talento, y una clasificación en la que algo cae en dos
-- cajones no clasifica nada: el mismo proyecto saldría bajo dos carpetas y el
-- visitante no sabría cuál mira.
--
-- ── LO QUE NO CAMBIA ──────────────────────────────────────────────────────────
-- La DESCRIPCIÓN sigue viviendo en esta tabla y no en el catálogo de talentos, y él
-- mismo lo confirmó: *«la descripción queda entre ámbito y talento, no es lo mismo
-- que la descripción del talento per se»*. Que la pareja sea única no la convierte
-- en propiedad del talento: describe **el talento ejercido dentro de su ámbito**, y
-- el catálogo además vive en el código, no en la base.
--
-- ── LA REGLA SE PONE EN LA BASE, NO EN LA PANTALLA ────────────────────────────
-- Una restricción que solo vive en el formulario se salta con una llamada a la API,
-- y entonces la web enseña el mismo proyecto en dos carpetas sin que nadie entienda
-- por qué. Aquí es imposible.
--
-- Comprobado antes de aplicar: hoy ningún talento está en dos ámbitos, así que no
-- hay nada que reconciliar.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Si alguno estuviera repetido, se queda el del ámbito de menor orden y se van los
-- demás. Sin esto el índice único no se podría crear y la migración fallaría a medias.
DELETE FROM gcc_world.ambito_talentos t
 USING gcc_world.ambito_talentos otro,
       gcc_world.ambitos a, gcc_world.ambitos b
 WHERE t.talento = otro.talento
   AND t.ambito_id <> otro.ambito_id
   AND a.id = t.ambito_id AND b.id = otro.ambito_id
   AND (b.orden, b.id) < (a.orden, a.id);

CREATE UNIQUE INDEX IF NOT EXISTS ambito_talentos_talento_unico
  ON gcc_world.ambito_talentos (talento);

COMMENT ON INDEX gcc_world.ambito_talentos_talento_unico IS
  'Un talento pertenece a UN solo ámbito (Fernando, 2026-08-18). El ámbito clasifica; algo que cae en dos cajones no está clasificado.';
