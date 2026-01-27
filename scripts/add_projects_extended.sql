-- =============================================
-- Extensión de Proyectos - Migración
-- =============================================

-- Imagenes en ofertas (JSONB array de URLs Cloudinary)
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS imagenes JSONB DEFAULT '[]'::jsonb;

-- Monto acordado al aceptar oferta
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS monto_acordado NUMERIC(12,2);

-- Flujo de confirmacion del miembro
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS fecha_aceptacion TIMESTAMPTZ;
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS confirmado_por_miembro BOOLEAN;
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS fecha_confirmacion TIMESTAMPTZ;

-- Quien creo el requerimiento
ALTER TABLE project_requirements ADD COLUMN IF NOT EXISTS creado_por VARCHAR(10) DEFAULT 'cliente';

-- Justificacion de cierre del proyecto
ALTER TABLE projects ADD COLUMN IF NOT EXISTS justificacion_cierre TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cerrado_por VARCHAR(10);

-- Restriccion de miembro para proyectos
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS restringido_proyectos BOOLEAN DEFAULT FALSE;
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS motivo_restriccion TEXT;
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS restringido_en TIMESTAMPTZ;

-- Tabla de IPs bloqueadas
CREATE TABLE IF NOT EXISTS blocked_ips (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  user_id UUID REFERENCES user_profiles(id),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);

-- Ultima IP conocida del usuario
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45);

-- Indice para consultas de auto-confirmacion
CREATE INDEX IF NOT EXISTS idx_project_bids_fecha_aceptacion
  ON project_bids(fecha_aceptacion)
  WHERE estado = 'aceptada' AND confirmado_por_miembro IS NULL;
