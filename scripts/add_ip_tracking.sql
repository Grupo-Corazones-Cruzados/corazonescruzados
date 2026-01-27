-- =====================================================
-- AGREGAR COLUMNA ip_address A TICKETS, TICKETS_PAQUETES Y ASPIRANTES
-- Para validacion de solicitudes anonimas por IP
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
CREATE INDEX IF NOT EXISTS idx_tickets_ip_address ON tickets(ip_address) WHERE ip_address IS NOT NULL;

-- Tickets Paquetes
ALTER TABLE tickets_paquetes ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
CREATE INDEX IF NOT EXISTS idx_tickets_paquetes_ip_address ON tickets_paquetes(ip_address) WHERE ip_address IS NOT NULL;

-- Aspirantes
ALTER TABLE aspirantes ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
CREATE INDEX IF NOT EXISTS idx_aspirantes_ip_address ON aspirantes(ip_address) WHERE ip_address IS NOT NULL;
