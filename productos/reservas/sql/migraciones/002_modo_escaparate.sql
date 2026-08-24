-- MODO ESCAPARATE: un alojamiento que se puede recorrer entero pero no se puede
-- cambiar.
--
-- Para qué: el «Hotel de Demostración» se le va a enseñar a gente de fuera. Tienen
-- que poder entrar, navegar, abrir los formularios y ver cómo funciona todo — pero
-- los datos tienen que seguir ahí mañana, intactos.
--
-- Se hace con DOS capas a propósito:
--   1. La aplicación lo impide y lo EXPLICA (mensaje claro al intentar guardar).
--   2. La base lo GARANTIZA, por si algún día se añade una pantalla nueva y a
--      alguien se le olvida la primera capa. Una promesa que solo vive en el código
--      de la aplicación se rompe con la siguiente funcionalidad.

ALTER TABLE "inquilinos"
  ADD COLUMN IF NOT EXISTS "solo_lectura" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "inquilinos"."solo_lectura" IS
  'Escaparate: se puede ver y navegar, no se puede guardar nada. Lo aplican la aplicación y los disparadores de ubicaciones/suites/reservas.';

-- El guardián. Vale para cualquier tabla que lleve `inquilino_id`.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_inquilino bigint;
  v_nombre    text;
BEGIN
  -- En un DELETE la fila nueva no existe, y en un INSERT no existe la vieja:
  -- referenciar la que no toca es un error en tiempo de ejecución.
  IF TG_OP = 'DELETE' THEN
    v_inquilino := OLD."inquilino_id";
  ELSE
    v_inquilino := NEW."inquilino_id";
  END IF;

  SELECT "nombre" INTO v_nombre
    FROM "inquilinos"
   WHERE "id" = v_inquilino AND "solo_lectura";

  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es un alojamiento de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Se protegen las tres tablas del día a día: son las que un visitante puede tocar
-- y las que el equipo GCC nunca edita a mano.
--
-- `usuarios` e `inquilinos` quedan FUERA a propósito, y el motivo importa: el
-- equipo GCC sí necesita poder cambiarle la contraseña al administrador del
-- escaparate o quitarle el modo. Un disparador ahí le cerraría la puerta también a
-- quien tiene que poder abrirla. Esas dos las guarda la aplicación.
DROP TRIGGER IF EXISTS "escaparate_ubicaciones" ON "ubicaciones";
CREATE TRIGGER "escaparate_ubicaciones"
  BEFORE INSERT OR UPDATE OR DELETE ON "ubicaciones"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate"();

DROP TRIGGER IF EXISTS "escaparate_suites" ON "suites";
CREATE TRIGGER "escaparate_suites"
  BEFORE INSERT OR UPDATE OR DELETE ON "suites"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate"();

DROP TRIGGER IF EXISTS "escaparate_reservas" ON "reservas"."reservas";
CREATE TRIGGER "escaparate_reservas"
  BEFORE INSERT OR UPDATE OR DELETE ON "reservas"."reservas"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate"();

-- El hotel de demostración pasa a ser el escaparate.
UPDATE "inquilinos" SET "solo_lectura" = true WHERE "slug" = 'demo';
