-- Las tablas nuevas de Unidades y el horario también quedan protegidas en un
-- inquilino de escaparate (llevan inquilino_id); `materias_docentes` lo hereda
-- de su materia.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['grados','materias_grado','horario_clases'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'escaparate_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION impedir_escritura_escaparate()',
      'escaparate_' || t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION "impedir_escritura_escaparate_materia_docente"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_materia bigint; v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_materia := OLD."materia_grado_id"; ELSE v_materia := NEW."materia_grado_id"; END IF;
  SELECT i."nombre" INTO v_nombre FROM "materias_grado" m JOIN "inquilinos" i ON i."id" = m."inquilino_id"
   WHERE m."id" = v_materia AND i."solo_lectura";
  IF FOUND THEN
    RAISE EXCEPTION 'ESCAPARATE: «%» es una institución de solo lectura; % en %.% no se guarda',
      v_nombre, TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
DROP TRIGGER IF EXISTS "escaparate_materias_docentes" ON "materias_docentes";
CREATE TRIGGER "escaparate_materias_docentes"
  BEFORE INSERT OR UPDATE OR DELETE ON "materias_docentes"
  FOR EACH ROW EXECUTE FUNCTION "impedir_escritura_escaparate_materia_docente"();
