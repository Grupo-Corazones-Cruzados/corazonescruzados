-- Add missing columns that are referenced in the code

-- 1. Add ip_address column to tickets table (for tracking public ticket creation)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Create index for faster IP lookups
CREATE INDEX IF NOT EXISTS idx_tickets_ip_address ON tickets(ip_address) WHERE ip_address IS NOT NULL;

-- 2. Add estado column to miembros table (for member status: activo, inactivo, etc.)
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'activo';

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_miembros_estado ON miembros(estado);

-- 3. Add celular column to miembros if it doesn't exist
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS celular VARCHAR(20);

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tickets' AND column_name = 'ip_address';

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'miembros' AND column_name IN ('estado', 'celular');
