-- Requerimientos Extendidos + Republicar + Cierre Colaborativo
-- Run this migration to add support for:
-- 1. es_adicional flag on requirements
-- 2. completado_por (who completed the requirement)
-- 3. republicado flag on projects
-- 4. trabajo_finalizado on project_bids

-- 1. Requerimiento inicial vs adicional
ALTER TABLE project_requirements ADD COLUMN IF NOT EXISTS es_adicional BOOLEAN DEFAULT FALSE;

-- 2. Quien completo el requerimiento
ALTER TABLE project_requirements ADD COLUMN IF NOT EXISTS completado_por INTEGER REFERENCES miembros(id);

-- 3. Republicar proyecto (flag en projects)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS republicado BOOLEAN DEFAULT FALSE;

-- 4. Trabajo finalizado por miembro (flag en cada bid aceptada)
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS trabajo_finalizado BOOLEAN DEFAULT FALSE;
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS fecha_trabajo_finalizado TIMESTAMPTZ;

-- 5. Quien creo el requerimiento (miembro o cliente)
ALTER TABLE project_requirements ADD COLUMN IF NOT EXISTS creado_por_miembro_id INTEGER REFERENCES miembros(id);
ALTER TABLE project_requirements ADD COLUMN IF NOT EXISTS creado_por_cliente_id INTEGER REFERENCES clientes(id);
