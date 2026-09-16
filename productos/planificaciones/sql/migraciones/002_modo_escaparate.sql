-- MODO ESCAPARATE: una institución que se recorre entera y no se puede cambiar.
--
-- Igual que en los otros tres productos, con dos capas: la aplicación lo impide y
-- lo explica; la base lo garantiza, por si mañana alguien añade una pantalla y se
-- olvida de la primera capa.

CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_inquilino bigint;
  v_nombre    text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_inquilino := OLD."inquilino_id"; ELSE v_inquilino := NEW."inquilino_id"; END IF;
  -- Las destrezas del catálogo común no tienen inquilino: no las cubre.
  IF v_inquilino IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  SELECT "nombre" INTO v_nombre FROM "inquilinos" WHERE "id" = v_inquilino AND "solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es una institución de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- `planificaciones_destrezas` no lleva `inquilino_id`: lo hereda de su semana.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate_destreza_semana"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_semana bigint; v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_semana := OLD."semana_id"; ELSE v_semana := NEW."semana_id"; END IF;
  SELECT i."nombre" INTO v_nombre FROM "planificaciones_semanales" s JOIN "inquilinos" i ON i."id" = s."inquilino_id"
   WHERE s."id" = v_semana AND i."solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es una institución de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- `adjunto_fragmentos` tampoco: lo hereda de su adjunto.
CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate_fragmento"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_adjunto bigint; v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_adjunto := OLD."adjunto_id"; ELSE v_adjunto := NEW."adjunto_id"; END IF;
  SELECT i."nombre" INTO v_nombre FROM "adjuntos" a JOIN "inquilinos" i ON i."id" = a."inquilino_id"
   WHERE a."id" = v_adjunto AND i."solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es una institución de solo lectura; % en %.% no se guarda',
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
  FOREACH t IN ARRAY ARRAY['planificaciones','planificaciones_semanales','adjuntos','destrezas'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'escaparate_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_escritura_escaparate()',
      'escaparate_' || t, t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS "escaparate_planificaciones_destrezas" ON "planificaciones_destrezas";
CREATE TRIGGER "escaparate_planificaciones_destrezas"
  BEFORE INSERT OR UPDATE OR DELETE ON "planificaciones_destrezas"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate_destreza_semana"();

DROP TRIGGER IF EXISTS "escaparate_adjunto_fragmentos" ON "adjunto_fragmentos";
CREATE TRIGGER "escaparate_adjunto_fragmentos"
  BEFORE INSERT OR UPDATE OR DELETE ON "adjunto_fragmentos"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate_fragmento"();
