-- ═══════════════════════════════════════════════════════════════════════════════
-- LOS PROYECTOS TAMBIÉN GUARDAN SU FECHA DE FINALIZACIÓN           (2026-10-31)
--
-- Lo mismo que la 077 para los tickets (Fernando: «cada vez que un ticket es completado hay que
-- guardar su fecha de finalización»), ahora que Clientes ▸ Proyectos lista los terminados igual que
-- los tickets y los ordena por cuándo terminaron. `projects` no tenía la columna, y un proyecto se
-- completa por CUATRO vías (cerrar el proyecto, el pago, la factura manual; y la anulación lo
-- reabre): por eso es un disparador y no una línea en cada ruta. Mismas reglas:
--   · pasa a `completed` y no trae fecha → `completed_at = now()`;
--   · deja de estar `completed` → `completed_at = NULL`.
-- Los 18 completados antes de hoy quedan sin fecha (no se inventa); el sitio usa su creación.
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE gcc_world.projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION gcc_world.proyecto_fecha_finalizacion() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    IF (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proyecto_fecha_finalizacion ON gcc_world.projects;
CREATE TRIGGER proyecto_fecha_finalizacion
  BEFORE INSERT OR UPDATE OF status, completed_at ON gcc_world.projects
  FOR EACH ROW EXECUTE FUNCTION gcc_world.proyecto_fecha_finalizacion();
