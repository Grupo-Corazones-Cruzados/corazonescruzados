-- ═══════════════════════════════════════════════════════════════════════════════
-- CADA TALENTO TIENE SU PROPIA PÁGINA                    (2026-08-18, Fernando)
--
-- `/ambitos/automatizacion-de-procesos` en vez de `/ambitos` con el talento elegido
-- por un clic. Cada talento pasa a ser una URL: se comparte por WhatsApp, se guarda
-- en marcadores y —lo que más pesa— **Google puede indexar una página por talento**
-- en vez de una sola con todo lo demás detrás de un panel.
--
-- ── POR QUÉ SE GUARDA Y NO SE CALCULA AL VUELO ────────────────────────────────
-- Se podría derivar del nombre en cada petición. No se hace, por lo mismo que el
-- `slug` de los ámbitos (migración 039): **es una URL**. Guardado, queda claro que
-- cambiarlo rompe enlaces ya repartidos; calculado, cualquier retoque del catálogo
-- de talentos movería direcciones publicadas sin que nadie lo decidiera.
--
-- ── ÚNICO EN TODA LA TABLA, NO POR ÁMBITO ─────────────────────────────────────
-- La ruta es `/ambitos/<slug>` y no lleva el ámbito dentro, así que dos talentos
-- con el mismo slug serían la misma página. Como además un talento pertenece a un
-- solo ámbito (migración 042), basta con que el slug sea único.
--
-- ── LAS TILDES SE QUITAN CON `translate`, NO CON `unaccent` ───────────────────
-- La extensión `unaccent` existe hoy en esta base, pero una migración que depende
-- de una extensión falla el día que se restaure en otra que no la tenga —y falla en
-- mitad de un despliegue—. `translate` es SQL de siempre y no depende de nada.
-- El resultado es el mismo que produce `aSlug()` en `lib/ambitos.ts`.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE gcc_world.ambito_talentos
  ADD COLUMN IF NOT EXISTS slug VARCHAR(80);

UPDATE gcc_world.ambito_talentos
   SET slug = left(
              trim(both '-' from
                regexp_replace(
                  lower(translate(talento,
                        'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
                        'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc')),
                  '[^a-z0-9]+', '-', 'g')),
              80)
 WHERE slug IS NULL OR slug = '';

ALTER TABLE gcc_world.ambito_talentos
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ambito_talentos_slug_unico
  ON gcc_world.ambito_talentos (slug);

COMMENT ON COLUMN gcc_world.ambito_talentos.slug IS
  'El tramo de la URL: /ambitos/<slug>. Se guarda porque ES una URL; cambiarlo rompe enlaces ya repartidos.';
