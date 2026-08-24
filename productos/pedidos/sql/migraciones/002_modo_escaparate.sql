-- MODO ESCAPARATE: un negocio que se recorre entero y no se puede cambiar.
--
-- Igual que en el producto de reservas, con dos capas: la aplicación lo impide y
-- lo explica; la base lo garantiza, por si mañana alguien añade una pantalla y se
-- olvida de la primera capa.

-- El guardián para las tablas que llevan `inquilino_id`.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_inquilino bigint;
  v_nombre    text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_inquilino := OLD."inquilino_id";
  ELSE
    v_inquilino := NEW."inquilino_id";
  END IF;

  SELECT "nombre" INTO v_nombre FROM "inquilinos" WHERE "id" = v_inquilino AND "solo_lectura";

  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es un negocio de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Y otro para `pedido_items`, que NO lleva `inquilino_id`: lo hereda de su pedido.
-- Hacen falta los dos porque una función que lee una columna inexistente falla en
-- tiempo de ejecución, no al crearla.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate_item"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_pedido bigint;
  v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_pedido := OLD."pedido_id"; ELSE v_pedido := NEW."pedido_id"; END IF;

  SELECT i."nombre" INTO v_nombre
    FROM "pedidos" p JOIN "inquilinos" i ON i."id" = p."inquilino_id"
   WHERE p."id" = v_pedido AND i."solo_lectura";

  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es un negocio de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Las tablas del día a día. `usuarios` e `inquilinos` quedan fuera a propósito: el
-- equipo GCC necesita poder cambiar la contraseña del escaparate y quitarle el modo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['zonas','mesas','categorias','productos','pedidos','reservas_mesa'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'escaparate_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_escritura_escaparate()',
      'escaparate_' || t, t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS "escaparate_pedido_items" ON "pedido_items";
CREATE TRIGGER "escaparate_pedido_items"
  BEFORE INSERT OR UPDATE OR DELETE ON "pedido_items"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate_item"();
