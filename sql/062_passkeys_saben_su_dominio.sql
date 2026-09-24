-- 062 — CADA PASSKEY GUARDA EL DOMINIO CON EL QUE NACIÓ.
--
-- ── POR QUÉ (2026-09-24) ─────────────────────────────────────────────────────────
-- Una passkey solo funciona desde un origen cuyo dominio sea su RP ID o termine en él.
-- Ayer el RP ID pasó de ser el host (`app.grupocc.org`, `www.grupocc.org`) a ser el
-- dominio de la casa (`grupocc.org`), para que UNA passkey valga en la plataforma, en el
-- juego y en los cinco productos.
--
-- El efecto colateral es que **las passkeys anteriores dejaron de servir**, en todas
-- partes. Y como esta tabla no guardaba el RP ID, la aplicación no podía distinguirlas:
-- seguía viendo una fila, seguía diciendo «esta cuenta tiene passkey» y seguía pintando
-- el botón «Usar mi passkey». Fernando lo pulsó y no había forma de que funcionara.
--
-- Un botón que solo sabe fallar es peor que no tener botón.
--
-- ── QUÉ HACE ─────────────────────────────────────────────────────────────────────
-- Añade `rp_id`. Las filas que ya existen se quedan en NULL **a propósito**: no sabemos
-- con qué host se crearon (dependía del `Host` de aquella petición) y NULL significa
-- exactamente eso, «de antes del cambio, no se puede usar». La aplicación solo ofrece
-- las que valen hoy, y a las demás les propone registrar una nueva.
--
-- ⚠️ No se borran. Borrarlas dejaría a alguien sin saber por qué desapareció su llave, y
-- además `credential_id` es único: conservarlas evita que una reinscripción choque.

ALTER TABLE gcc_world.client_passkeys
  ADD COLUMN IF NOT EXISTS rp_id text;

COMMENT ON COLUMN gcc_world.client_passkeys.rp_id IS
  'Dominio (RP ID) con el que se creó la passkey. NULL = anterior al 2026-09-24, inservible.';

-- Se consulta siempre filtrando por `rp_id`, así que el índice lo acompaña.
CREATE INDEX IF NOT EXISTS client_passkeys_client_rp_idx
  ON gcc_world.client_passkeys (client_id, rp_id);
