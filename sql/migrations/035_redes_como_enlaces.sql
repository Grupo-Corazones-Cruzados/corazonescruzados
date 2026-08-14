-- ─────────────────────────────────────────────────────────────────────────────
-- LAS REDES SOCIALES PASAN DE «@usuario» A ENLACE
--
-- ── POR QUÉ ───────────────────────────────────────────────────────────────────
-- Los cuatro campos `*_handle` de `users` guardaban texto libre («@lfgonzalezm0»),
-- pensado para redactar un copy. Sirve para escribir, pero **no se puede pulsar**, y
-- el CV público los enseña como botones a un reclutador. Un botón que no lleva a
-- ninguna parte es peor que no tener botón.
--
-- ── NO SE RENOMBRAN LAS COLUMNAS ──────────────────────────────────────────────
-- Siguen llamándose `*_handle` a propósito: renombrarlas obliga a tocar la API, el
-- tipo `User`, `/api/auth/me` y el panel a la vez, y el nombre no es el problema.
-- Lo que cambia es **qué se guarda dentro**, y eso lo garantiza `normalizarRed()`
-- en `lib/members/redes.ts`, que es la única puerta de escritura.
--
-- ── LA CONVERSIÓN ES CONSERVADORA ─────────────────────────────────────────────
-- Solo se toca lo que **claramente** es un usuario y no una dirección: sin `/` y sin
-- `.`. Cualquier otra cosa se deja como está para que la revise su dueño; el
-- formulario la validará la próxima vez que se guarde. Antes de aplicarla había una
-- sola fila con datos, así que el alcance real es mínimo.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE gcc_world.users
   SET youtube_handle = 'https://www.youtube.com/@' || ltrim(trim(youtube_handle), '@')
 WHERE youtube_handle IS NOT NULL
   AND trim(youtube_handle) <> ''
   AND trim(youtube_handle) !~ '[/.]';

UPDATE gcc_world.users
   SET tiktok_handle = 'https://www.tiktok.com/@' || ltrim(trim(tiktok_handle), '@')
 WHERE tiktok_handle IS NOT NULL
   AND trim(tiktok_handle) <> ''
   AND trim(tiktok_handle) !~ '[/.]';

UPDATE gcc_world.users
   SET instagram_handle = 'https://www.instagram.com/' || ltrim(trim(instagram_handle), '@')
 WHERE instagram_handle IS NOT NULL
   AND trim(instagram_handle) <> ''
   AND trim(instagram_handle) !~ '[/.]';

UPDATE gcc_world.users
   SET facebook_handle = 'https://www.facebook.com/' || ltrim(trim(facebook_handle), '@')
 WHERE facebook_handle IS NOT NULL
   AND trim(facebook_handle) <> ''
   AND trim(facebook_handle) !~ '[/.]';

COMMENT ON COLUMN gcc_world.users.youtube_handle IS
  'URL ABSOLUTA del perfil (no un @usuario). Se escribe solo a través de normalizarRed() en lib/members/redes.ts. Se publica en el CV público como botón.';
COMMENT ON COLUMN gcc_world.users.tiktok_handle IS 'URL absoluta del perfil. Ver youtube_handle.';
COMMENT ON COLUMN gcc_world.users.instagram_handle IS 'URL absoluta del perfil. Ver youtube_handle.';
COMMENT ON COLUMN gcc_world.users.facebook_handle IS 'URL absoluta del perfil. Ver youtube_handle.';
