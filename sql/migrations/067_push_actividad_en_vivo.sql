-- ─────────────────────────────────────────────────────────────────────────────
-- 067 · Push del iPhone: la Actividad en Vivo del reloj (Fernando, 2026-10-07)
-- ─────────────────────────────────────────────────────────────────────────────
-- Para que un reloj iniciado en el computador aparezca en el iPhone con la app cerrada, el
-- servidor manda a Apple una orden «start» al token `apns_live_start` del teléfono. Cada
-- Actividad en Vivo abierta da además SU token (`apns_live_update`), que es al que se manda
-- «end» al detener el reloj: por eso se guarda de qué registro es.
--
-- `entorno`: las apps instaladas desde Xcode hablan con el APNs de pruebas (sandbox); las de
-- TestFlight, con el de producción. Un token solo vale en su entorno.
ALTER TABLE gcc_world.push_devices ADD COLUMN IF NOT EXISTS registro_id BIGINT;
ALTER TABLE gcc_world.push_devices ADD COLUMN IF NOT EXISTS entorno TEXT
  CHECK (entorno IS NULL OR entorno IN ('sandbox', 'production'));
ALTER TABLE gcc_world.push_devices DROP CONSTRAINT IF EXISTS push_devices_kind_check;
ALTER TABLE gcc_world.push_devices ADD CONSTRAINT push_devices_kind_check
  CHECK (kind IN ('fcm', 'apns', 'apns_live_start', 'apns_live_update'));
CREATE INDEX IF NOT EXISTS push_devices_registro_idx ON gcc_world.push_devices (registro_id)
  WHERE registro_id IS NOT NULL;
