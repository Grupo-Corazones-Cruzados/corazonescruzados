-- ================================================
-- Sistema de Compra y Consumo de Paquetes
-- ================================================

-- Tabla principal: Compras de paquetes
CREATE TABLE IF NOT EXISTS package_purchases (
  id BIGSERIAL PRIMARY KEY,
  id_cliente UUID NOT NULL REFERENCES user_profiles(id),
  id_miembro BIGINT NOT NULL REFERENCES miembros(id),
  id_paquete BIGINT NOT NULL REFERENCES paquetes(id),

  -- Estado del paquete
  estado VARCHAR(30) DEFAULT 'pendiente' CHECK (
    estado IN ('pendiente', 'aprobado', 'rechazado', 'en_espera',
               'en_progreso', 'completado', 'cancelado', 'expirado')
  ),

  -- Horas
  horas_totales DECIMAL(5,2) NOT NULL,
  horas_consumidas DECIMAL(5,2) DEFAULT 0,
  horas_restantes DECIMAL(5,2) GENERATED ALWAYS AS (horas_totales - horas_consumidas) STORED,

  -- Respuesta del miembro
  fecha_respuesta TIMESTAMPTZ,
  motivo_rechazo TEXT,
  motivo_espera TEXT,

  -- Metadata
  notas_cliente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  reporte_cierre TEXT
);

-- Indices para package_purchases
CREATE INDEX IF NOT EXISTS idx_package_purchases_cliente ON package_purchases(id_cliente);
CREATE INDEX IF NOT EXISTS idx_package_purchases_miembro ON package_purchases(id_miembro);
CREATE INDEX IF NOT EXISTS idx_package_purchases_estado ON package_purchases(estado);

-- Tabla de sesiones programadas
CREATE TABLE IF NOT EXISTS package_sessions (
  id BIGSERIAL PRIMARY KEY,
  id_purchase BIGINT NOT NULL REFERENCES package_purchases(id) ON DELETE CASCADE,

  -- Programacion
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_horas DECIMAL(4,2) NOT NULL,

  -- Estado
  estado VARCHAR(20) DEFAULT 'programada' CHECK (
    estado IN ('programada', 'completada', 'cancelada', 'reprogramada', 'no_asistio')
  ),

  -- Seguimiento
  notas_miembro TEXT,
  notas_cliente TEXT,
  fecha_completada TIMESTAMPTZ,

  -- Solicitud de cambio
  cambio_solicitado BOOLEAN DEFAULT FALSE,
  motivo_cambio TEXT,
  nueva_fecha_propuesta DATE,
  nueva_hora_propuesta TIME,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices para package_sessions
CREATE INDEX IF NOT EXISTS idx_package_sessions_purchase ON package_sessions(id_purchase);
CREATE INDEX IF NOT EXISTS idx_package_sessions_fecha ON package_sessions(fecha);

-- Tabla de disponibilidad por paquete
CREATE TABLE IF NOT EXISTS package_availability (
  id BIGSERIAL PRIMARY KEY,
  id_purchase BIGINT NOT NULL REFERENCES package_purchases(id) ON DELETE CASCADE,

  -- Disponibilidad semanal
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  activo BOOLEAN DEFAULT TRUE,

  UNIQUE(id_purchase, dia_semana, hora_inicio)
);

-- Trigger para actualizar updated_at en package_purchases
CREATE OR REPLACE FUNCTION update_package_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_package_purchases_updated_at ON package_purchases;
CREATE TRIGGER trigger_package_purchases_updated_at
  BEFORE UPDATE ON package_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_package_purchases_updated_at();

-- Trigger para actualizar horas_consumidas cuando se completa una sesion
CREATE OR REPLACE FUNCTION update_package_hours_on_session_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la sesion cambia a completada
  IF NEW.estado = 'completada' AND (OLD.estado IS NULL OR OLD.estado != 'completada') THEN
    UPDATE package_purchases
    SET horas_consumidas = horas_consumidas + NEW.duracion_horas
    WHERE id = NEW.id_purchase;

    -- Cambiar estado a en_progreso si estaba aprobado
    UPDATE package_purchases
    SET estado = 'en_progreso'
    WHERE id = NEW.id_purchase AND estado = 'aprobado';
  END IF;

  -- Si la sesion deja de estar completada (por ejemplo, se cancela)
  IF OLD.estado = 'completada' AND NEW.estado != 'completada' THEN
    UPDATE package_purchases
    SET horas_consumidas = GREATEST(0, horas_consumidas - OLD.duracion_horas)
    WHERE id = NEW.id_purchase;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_package_hours ON package_sessions;
CREATE TRIGGER trigger_update_package_hours
  AFTER UPDATE ON package_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_package_hours_on_session_complete();

-- Trigger para verificar cierre automatico cuando horas_restantes llega a 0
CREATE OR REPLACE FUNCTION check_package_auto_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.horas_consumidas >= NEW.horas_totales AND NEW.estado = 'en_progreso' THEN
    NEW.estado = 'completado';
    NEW.fecha_cierre = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_package_auto_complete ON package_purchases;
CREATE TRIGGER trigger_check_package_auto_complete
  BEFORE UPDATE ON package_purchases
  FOR EACH ROW
  EXECUTE FUNCTION check_package_auto_complete();
