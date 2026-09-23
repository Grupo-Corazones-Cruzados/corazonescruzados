-- 005_indices_de_la_cola — los dos índices que hacen que la cola funcione
--
-- ⚠️ PRISMA NO SABE EXPRESAR UN ÍNDICE PARCIAL, así que estos no salieron del modelo y
-- habrían faltado sin que nada se quejara. El fallo no habría sido un error: habría sido
-- que **el debounce deja de existir**.
--
-- `agente_cola_pendiente_uq` en la plataforma es lo que permite que `encolar()` haga
--   ON CONFLICT (conversacion_id) WHERE estado IN ('pendiente','procesando')
-- y, en vez de crear un trabajo nuevo, EMPUJE el `ejecutar_en` del que ya hay. Sin él,
-- seis mensajes seguidos de un cliente serían seis corridas del modelo en vez de una: el
-- agente contestaría frase por frase y costaría seis veces más.
--
-- El segundo es el que usa `reclamar()`: parcial sobre los pendientes, que son los únicos
-- que se buscan.

CREATE UNIQUE INDEX IF NOT EXISTS "cola_pendiente_uq"
    ON "cola" ("conversacion_id")
 WHERE "estado" IN ('pendiente', 'procesando');

CREATE INDEX IF NOT EXISTS "cola_reclamar_idx"
    ON "cola" ("estado", "ejecutar_en")
 WHERE "estado" = 'pendiente';
