-- ═══════════════════════════════════════════════════════════════════════════════
-- «ÁMBITO» PASA A LLAMARSE «SOLUCIÓN», TAMBIÉN POR DENTRO  (2026-08-18, Fernando)
--
-- ── POR QUÉ ───────────────────────────────────────────────────────────────────
-- El 2026-08-18 la página pasó de `/ambitos` a `/soluciones`, pero el concepto
-- interno se quedó llamándose «ámbito»: la tabla, la API, la pestaña del admin.
-- Fernando: *«podemos actualizar todos esos conceptos internos y demás, las
-- referencias ahora deben ser siempre soluciones, porque de esa manera no nos
-- confundiremos a futuro»*. Tiene razón: **un nombre interno que no coincide con el
-- publicado es una trampa** para quien lea esto dentro de seis meses, y lo peor es
-- que «soluciones» ya significaba otra cosa hace un día.
--
-- ── LO QUE ESTA MIGRACIÓN NO PUEDE EVITAR ─────────────────────────────────────
-- ⚠️ Renombrar tablas **rompe el código viejo mientras se despliega el nuevo**. La
-- ventana es corta y el daño, mínimo: `/soluciones` es HTML prerenderizado con
-- `revalidate`, así que los visitantes siguen viendo la última versión buena; solo
-- el panel de administración queda inservible hasta que termine el despliegue.
-- Se asume a sabiendas: la alternativa —vistas de compatibilidad con los nombres
-- viejos— deja para siempre dos nombres vivos, que es justo lo que se viene a
-- quitar.
--
-- `ALTER TABLE … RENAME` conserva datos, claves foráneas y permisos: no se copia ni
-- se recrea nada.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE gcc_world.ambitos          RENAME TO soluciones;
ALTER TABLE gcc_world.ambito_talentos  RENAME TO solucion_talentos;

ALTER TABLE gcc_world.solucion_talentos RENAME COLUMN ambito_id TO solucion_id;

-- Los índices también, o al leer un plan de consulta dentro de un año aparecerá un
-- nombre que ya no existe en ninguna parte del código.
ALTER INDEX gcc_world.ambitos_pkey                    RENAME TO soluciones_pkey;
ALTER INDEX gcc_world.ambitos_slug_key                RENAME TO soluciones_slug_key;
ALTER INDEX gcc_world.ambitos_orden_idx               RENAME TO soluciones_orden_idx;
ALTER INDEX gcc_world.ambito_talentos_pkey            RENAME TO solucion_talentos_pkey;
ALTER INDEX gcc_world.ambito_talentos_talento_idx     RENAME TO solucion_talentos_talento_idx;
ALTER INDEX gcc_world.ambito_talentos_talento_unico   RENAME TO solucion_talentos_talento_unico;
ALTER INDEX gcc_world.ambito_talentos_slug_unico      RENAME TO solucion_talentos_slug_unico;

COMMENT ON TABLE gcc_world.soluciones IS
  'Tipos de proyecto que maneja el grupo. Se editan en Admin → Soluciones y se publican en /soluciones. Se llamó «ambitos» hasta el 2026-08-18.';

COMMENT ON COLUMN gcc_world.solucion_talentos.talento IS
  'Nombre EXACTO del catálogo de lib/centralized/talentos.ts. Texto y no FK: el catálogo vive en el código.';

COMMENT ON COLUMN gcc_world.solucion_talentos.descripcion IS
  'Cómo se ejerce este talento dentro de ESTA solución. Se publica en /soluciones bajo el título del talento. NULL = no se pinta.';

COMMENT ON COLUMN gcc_world.solucion_talentos.slug IS
  'El tramo de la URL: /soluciones/<slug>. Se guarda porque ES una URL; cambiarlo rompe enlaces ya repartidos.';

COMMENT ON INDEX gcc_world.solucion_talentos_talento_unico IS
  'Un talento pertenece a UNA sola solución (Fernando, 2026-08-18). La solución clasifica; algo que cae en dos cajones no está clasificado.';
