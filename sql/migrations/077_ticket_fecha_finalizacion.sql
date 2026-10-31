-- ═══════════════════════════════════════════════════════════════════════════════
-- AL COMPLETAR UN TICKET SE GUARDA SU FECHA DE FINALIZACIÓN      (2026-10-31, Fernando)
--
-- Textual: *«cada vez que un ticket es completado hay que guardar su fecha de finalización»*.
-- Al 2026-10-31 solo 4 de 27 tickets completados la tenían: el estado se cambia por TRES vías
-- (el panel, la factura desde el ticket y la factura manual) y ninguna escribía `completed_at`.
--
-- Se hace con un disparador y no en cada ruta: así vale para las tres vías y para cualquiera que
-- se añada después. Reglas:
--   · pasa a `completed` y no trae fecha → `completed_at = now()`;
--   · deja de estar `completed` (p. ej. al anular su factura) → `completed_at = NULL`.
-- Si quien actualiza ya trae una fecha, se respeta.
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION gcc_world.ticket_fecha_finalizacion() RETURNS trigger AS $$
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

DROP TRIGGER IF EXISTS ticket_fecha_finalizacion ON gcc_world.tickets;
CREATE TRIGGER ticket_fecha_finalizacion
  BEFORE INSERT OR UPDATE OF status, completed_at ON gcc_world.tickets
  FOR EACH ROW EXECUTE FUNCTION gcc_world.ticket_fecha_finalizacion();
