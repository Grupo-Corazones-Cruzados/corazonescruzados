-- 010_modo_escaparate — un inquilino que se recorre entero y no se puede cambiar
--
-- La ficha del marketplace necesita un «Probar la demostración», y una demostración cuyos
-- datos se vacíen con el primer visitante no sirve para el segundo. Así que el inquilino
-- de muestra es de SOLO LECTURA, y eso se garantiza en DOS capas:
--
--   1. La aplicación lo impide y lo EXPLICA (`contextoEscritura()` en lib/inquilino.ts).
--   2. La base lo garantiza, que es esto.
--
-- Hacen falta las dos: una promesa que solo vive en el código se rompe con la siguiente
-- pantalla que alguien añada sin acordarse.

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
    RAISE EXCEPTION 'ESCAPARATE: «%» es un cliente de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Las tablas del día a día: lo que un visitante puede tocar desde la aplicación.
--
-- ⚠️ `usuarios` e `inquilinos` quedan FUERA a propósito: el equipo GCC tiene que poder
-- cambiarle la contraseña al administrador del escaparate o quitarle el modo, y un
-- disparador ahí se lo impediría también a quien sí debe poder. Esas dos las guarda la
-- aplicación.
--
-- ⚠️ `mensajes`, `conversaciones`, `contactos`, `cola` y `eventos_webhook` TAMPOCO llevan
-- disparador, y esta es la decisión que más importa: por ahí entra lo que manda Meta. Si
-- algún día el escaparate tuviera un número conectado, un disparador ahí haría que el
-- webhook fallara en silencio. La demostración no conecta número: su bandeja es histórico.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['automatizaciones','canales','conocimiento','prompts',
                           'plantillas_agente','envios','listas_contactos','contactos_lista',
                           'campanas','plantillas_wa']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'escaparate_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate"()',
      'escaparate_' || t, t);
  END LOOP;
END $$;
