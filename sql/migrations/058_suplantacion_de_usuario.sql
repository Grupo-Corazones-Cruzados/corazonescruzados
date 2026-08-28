-- VER LA PLATAFORMA CON LOS OJOS DE OTRO: el registro de quién lo hizo y cuándo.
--
-- Un administrador puede tomar la vista de cualquier usuario para comprobar qué ve
-- realmente —lo que a Peter Tours le costó una tarde de «a mí no me sale ese botón»—
-- sin pedirle su contraseña ni entrar por su sesión.
--
-- ⚠️ ESTA TABLA NO ES UN EXTRA, ES LA CONDICIÓN PARA QUE LA FUNCIÓN EXISTA.
-- Mientras dura, el administrador actúa CON LA IDENTIDAD DE OTRA PERSONA: lo que escriba
-- quedará firmado por ella. Sin registro no habría forma de distinguir lo que hizo el
-- usuario de lo que hicimos nosotros en su nombre — ni de responder a un cliente que
-- pregunte quién tocó su cuenta. Y en el servicio de WhatsApp GCC es ENCARGADO del
-- tratamiento: la trazabilidad de quién accede a los datos de un cliente es exigible.
--
-- Se anota al ENTRAR y se cierra al SALIR. Una fila sin `terminada_en` es una vista
-- todavía abierta (o una que acabó porque caducó la sesión, que también es información).

CREATE TABLE IF NOT EXISTS gcc_world.suplantaciones (
  id            SERIAL PRIMARY KEY,
  -- Quién miró. Si se borra su cuenta, el registro se queda: es justo lo que hay que poder
  -- consultar después.
  admin_id      UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE RESTRICT,
  admin_email   TEXT NOT NULL,
  -- A quién. Se guarda también el correo por si la cuenta desaparece.
  usuario_id    UUID NOT NULL REFERENCES gcc_world.users(id) ON DELETE RESTRICT,
  usuario_email TEXT NOT NULL,
  usuario_rol   TEXT NOT NULL,
  ip_hash       TEXT,
  iniciada_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  terminada_en  TIMESTAMPTZ
);

COMMENT ON TABLE gcc_world.suplantaciones IS
  'Cada vez que un administrador toma la vista de otro usuario. Se abre al entrar y se cierra al volver.';

-- Las dos preguntas que se le hacen a esto: «¿quién ha entrado en la cuenta de X?» y
-- «¿qué ha estado mirando el administrador Y?».
CREATE INDEX IF NOT EXISTS suplantaciones_usuario_idx ON gcc_world.suplantaciones (usuario_id, iniciada_en DESC);
CREATE INDEX IF NOT EXISTS suplantaciones_admin_idx   ON gcc_world.suplantaciones (admin_id, iniciada_en DESC);
