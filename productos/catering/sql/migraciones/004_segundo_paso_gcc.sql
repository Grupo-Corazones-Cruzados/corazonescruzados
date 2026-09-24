-- 004 — EL SEGUNDO PASO PARA LOS CLIENTES DE GCC WORLD.
--
-- Fernando, 2026-09-24: «que en los productos ya apliquemos la identificación de cuentas
-- de clientes de gcc world, y obligues a ingresar el segundo paso… replica lo mismo en
-- las páginas de login de cada producto, donde hay dos opciones de segundo paso, la
-- passkey o el correo».
--
-- La identidad NO se guarda aquí: se le pregunta a la plataforma por el correo
-- (`lib/identidadGcc.ts`). Lo único que hace falta en esta base es el freno, porque a
-- partir de ahora esta pantalla comprueba contraseñas de GCC World y un formulario sin
-- límite es un sitio cómodo donde probarlas.

ALTER TABLE catering.usuarios
  ADD COLUMN IF NOT EXISTS intentos_fallidos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bloqueado_hasta   timestamptz(3);
