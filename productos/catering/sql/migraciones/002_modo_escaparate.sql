-- MODO ESCAPARATE: un negocio que se recorre entero y no se puede cambiar.
--
-- Igual que en reservas y pedidos, con dos capas: la aplicación lo impide y lo
-- explica; la base lo garantiza, por si mañana alguien añade una pantalla y se
-- olvida de la primera capa.

-- El guardián para las tablas que llevan `inquilino_id`.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_inquilino bigint;
  v_nombre    text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_inquilino := OLD."inquilino_id"; ELSE v_inquilino := NEW."inquilino_id"; END IF;
  SELECT "nombre" INTO v_nombre FROM "inquilinos" WHERE "id" = v_inquilino AND "solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es un negocio de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- `cliente_restricciones` no lleva `inquilino_id`: lo hereda de su cliente.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate_restriccion"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_cliente bigint; v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_cliente := OLD."cliente_id"; ELSE v_cliente := NEW."cliente_id"; END IF;
  SELECT i."nombre" INTO v_nombre FROM "clientes" c JOIN "inquilinos" i ON i."id" = c."inquilino_id"
   WHERE c."id" = v_cliente AND i."solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es un negocio de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- `menu_alimentos` tampoco: lo hereda de su menú.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate_menu_alimento"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_menu bigint; v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_menu := OLD."menu_id"; ELSE v_menu := NEW."menu_id"; END IF;
  SELECT i."nombre" INTO v_nombre FROM "menus" m JOIN "inquilinos" i ON i."id" = m."inquilino_id"
   WHERE m."id" = v_menu AND i."solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es un negocio de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Las tablas del día a día. `usuarios`, `inquilinos`, `suscripciones` y `pagos`
-- quedan fuera a propósito: el equipo GCC necesita poder administrar el escaparate.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','alimentos','servicios','cancelaciones','menus','motorizados','feriados','mensajes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'escaparate_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_escritura_escaparate()',
      'escaparate_' || t, t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS "escaparate_cliente_restricciones" ON "cliente_restricciones";
CREATE TRIGGER "escaparate_cliente_restricciones"
  BEFORE INSERT OR UPDATE OR DELETE ON "cliente_restricciones"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate_restriccion"();

DROP TRIGGER IF EXISTS "escaparate_menu_alimentos" ON "menu_alimentos";
CREATE TRIGGER "escaparate_menu_alimentos"
  BEFORE INSERT OR UPDATE OR DELETE ON "menu_alimentos"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate_menu_alimento"();
