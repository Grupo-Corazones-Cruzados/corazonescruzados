-- 022 — Manifiesto de objetos colocados en los mundos (2026-07-20)
--
-- Contexto: al pasar la autoría de mapas a Godot, los mundos dejan de vivir en
-- `world_maps` y pasan a ser parte del build. Eso deja al servidor SIN forma de
-- saber qué objetos existen ni dónde están, y por tanto sin forma de validar
-- una recogida.
--
-- Con fichas canjeables por productos reales eso es inaceptable: si el servidor
-- se fía de lo que diga el juego, cualquiera se sirve solo desde la consola del
-- navegador. Esta tabla es la copia que el servidor SÍ controla: se genera al
-- exportar el mundo y se sincroniza aquí.
--
-- Es contenido de administrador, no estado de jugador. Se puede regenerar
-- entera sin perder nada: lo que un jugador ya recogió vive aparte.

CREATE TABLE IF NOT EXISTS gcc_world.item_placements (
  scene        text NOT NULL,
  -- Ruta del nodo dentro de la escena de Godot. Estable al mover el objeto,
  -- NO al renombrarlo (renombrar uno ya recogido lo hace reaparecer una vez).
  placement_id text NOT NULL,
  item_id      text NOT NULL,
  quantity     integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  -- En tiles, no en píxeles: así no depende de la escala de dibujo.
  x            integer NOT NULL,
  y            integer NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scene, placement_id)
);

CREATE INDEX IF NOT EXISTS item_placements_scene_idx
  ON gcc_world.item_placements (scene);

-- Registro de cada sincronización, para poder responder "¿desde cuándo está
-- así?" cuando un jugador reclame que un objeto no aparece.
CREATE TABLE IF NOT EXISTS gcc_world.item_placement_syncs (
  id         bigserial PRIMARY KEY,
  scenes     integer NOT NULL,
  placements integer NOT NULL,
  removed    integer NOT NULL DEFAULT 0,
  synced_at  timestamptz NOT NULL DEFAULT now()
);
