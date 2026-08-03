-- ─────────────────────────────────────────────────────────────────────────────
-- CUENTAS EXENTAS DEL SEGUNDO FACTOR
--
-- ── POR QUÉ EXISTE ESTO, QUE DEBILITA EL ACCESO ───────────────────────────────
-- El acceso al panel manda un código de seis dígitos al correo de la cuenta. Eso deja
-- fuera a **quien no puede leer ese buzón**, y hay un caso legítimo y concreto: el
-- revisor de Meta. Su cuenta vive en nuestro dominio, así que el código llega a un buzón
-- nuestro y no suyo. Sin esta exención, la única alternativa sería darle acceso a un
-- correo de la organización — mucho peor.
--
-- ── LOS LÍMITES, QUE SON LA MITAD DEL DISEÑO ──────────────────────────────────
-- · **Por cuenta, no por rol.** No es «los clientes no llevan segundo factor»: es ESTA
--   cuenta, señalada a mano.
-- · **No se enciende desde la interfaz.** No hay pantalla, ni botón, ni endpoint que lo
--   active: solo un UPDATE en la base hecho a conciencia. Si se pudiera activar desde la
--   app, sería el primer sitio al que iría quien entrara con una sesión robada.
-- · **`motivo` es obligatorio en la práctica**: una exención sin explicación escrita es
--   una exención que dentro de un año nadie sabrá si sigue haciendo falta.
--
-- La contraseña sigue siendo obligatoria. Lo que se salta es el código, no el acceso.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gcc_world.users
  ADD COLUMN IF NOT EXISTS sin_doble_factor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sin_doble_factor_motivo TEXT;

COMMENT ON COLUMN gcc_world.users.sin_doble_factor IS
  'Excepción al código por correo. Solo para cuentas cuyo buzón no controla quien la usa (revisores). Se activa a mano en la base, nunca desde la app.';

UPDATE gcc_world.users
   SET sin_doble_factor = true,
       sin_doble_factor_motivo =
         'Cuenta para el App Review de Meta (2026-08-03). El código de acceso llegaría a un buzón de GCC, '
         'no del revisor. Revisar cuando termine la revisión: si ya no hace falta, poner en false.'
 WHERE email = 'revisor.meta@grupocc.org';
