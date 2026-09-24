-- 012 — LAS CUENTAS DE UN INQUILINO SON DEL INQUILINO, NO DE GCC WORLD.
--
-- ── QUÉ PASABA (Fernando, 2026-09-24) ────────────────────────────────────────────
-- El administrador de un inquilino podía crear cuentas de «origen GCC», es decir,
-- enlazadas a una cuenta de cliente de GCC World. Fernando: «todas las cuentas que se
-- crean en los productos pertenecen al tenant del cliente que compró el producto… no
-- son cuentas de clientes de gcc world», y «son cuentas de gente externa que no
-- conocemos ni confiamos».
--
-- El daño no era que se crearan filas de más. Era que la pantalla de acceso de un
-- inquilino **comprueba contraseñas contra `gcc_world.users`** para esas cuentas. Con el
-- alta abierta al cliente, cualquier administrador de un inquilino podía:
--   · escribir un correo cualquiera y que el formulario le dijera si tiene cuenta en la
--     plataforma (un listín de nuestros clientes, consultable desde fuera);
--   · y después probar contraseñas contra ella sin límite, en un formulario que no es el
--     de GCC World. Acertar una vez es entrar en la plataforma.
--
-- ── LO QUE AÑADE ─────────────────────────────────────────────────────────────────
-- · `enlazado_por` — quién de GCC enlazó la cuenta. Sin esto no se entra con origen GCC.
-- · `intentos_fallidos` / `bloqueado_hasta` — freno a la prueba de contraseñas.
--
-- Las cuatro cuentas de origen GCC que ya existen las creó la SEMILLA del producto, no
-- ningún cliente (comprobado en la base antes de escribir esto), así que se marcan como
-- enlazadas y siguen entrando igual.

ALTER TABLE automatizaciones.usuarios
  ADD COLUMN IF NOT EXISTS enlazado_por      text,
  ADD COLUMN IF NOT EXISTS intentos_fallidos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta   timestamptz(3);

UPDATE automatizaciones.usuarios
   SET enlazado_por = 'semilla'
 WHERE origen = 'GCC' AND enlazado_por IS NULL;

-- ⚠️ La regla queda también en la BASE, no solo en el código: una cuenta de origen GCC
-- sin quien la enlazara no se puede guardar. Si mañana una acción nueva se olvida de la
-- comprobación, la base la para. Las del producto nunca llevan enlace.
ALTER TABLE automatizaciones.usuarios
  DROP CONSTRAINT IF EXISTS usuarios_enlace_coherente;
ALTER TABLE automatizaciones.usuarios
  ADD CONSTRAINT usuarios_enlace_coherente CHECK (
    (origen = 'GCC'      AND enlazado_por IS NOT NULL AND clave_hash IS NULL) OR
    (origen = 'PRODUCTO' AND enlazado_por IS NULL)
  );
