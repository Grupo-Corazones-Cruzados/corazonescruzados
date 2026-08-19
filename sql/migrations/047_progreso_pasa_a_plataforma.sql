-- ─────────────────────────────────────────────────────────────────────────────
-- `progreso` → `plataforma` (Fernando, 2026-08-19, por la tarde)
--
-- Segundo renombrado de la misma sección en el mismo día: nació como `requerimientos`
-- (2026-08-04), pasó a `progreso` por la mañana —migración 046— y ahora a `plataforma`.
--
-- El `id` de `ACCESOS` es a la vez el tramo de la URL y **la clave con la que se guardan las
-- preguntas frecuentes**. Esto es la parte de la base; la de las URLs está en `next.config.ts`.
--
-- ⚠️ Se cubren **los dos nombres viejos**, no solo el último. `gcc_world.faqs` sigue vacía
-- (comprobado), así que hoy no mueve ni una fila; pero si alguien creó una pregunta entre la
-- migración 046 y esta, estaría guardada como `progreso`, y si la creó antes, como
-- `requerimientos`. Cubrir uno solo dejaría la otra huérfana: guardada, correcta y sin salir
-- en ninguna página.
--
-- Idempotente por construcción: sin filas con los nombres viejos no hace nada, y repetirla
-- tampoco.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE gcc_world.faqs SET acceso_id = 'plataforma' WHERE acceso_id IN ('progreso', 'requerimientos');
