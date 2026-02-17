-- =====================================================
-- SISTEMA DE PAQUETES MULTI-MIEMBRO
-- Crear tablas: paquete_solicitudes, paquete_asignaciones, paquete_avances
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- PASO 1: TABLAS
-- =====================================================

-- Tabla principal: Solicitud del cliente
CREATE TABLE IF NOT EXISTS paquete_solicitudes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente UUID REFERENCES user_profiles(id),
    horas_totales DECIMAL(8,2) NOT NULL,
    horas_asignadas DECIMAL(8,2) DEFAULT 0,
    costo_hora DECIMAL(8,2) DEFAULT 10.00,
    descuento INTEGER DEFAULT 0,
    id_paquete_tier BIGINT REFERENCES paquetes(id),
    estado VARCHAR(30) DEFAULT 'borrador' CHECK (estado IN ('borrador', 'pendiente', 'parcial', 'en_progreso', 'completado', 'cancelado')),
    notas_cliente TEXT,
    fecha_completado TIMESTAMPTZ
);

-- Tabla de asignaciones por miembro
CREATE TABLE IF NOT EXISTS paquete_asignaciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_solicitud BIGINT REFERENCES paquete_solicitudes(id) ON DELETE CASCADE,
    id_miembro BIGINT REFERENCES miembros(id),
    horas_asignadas DECIMAL(8,2) NOT NULL,
    horas_consumidas DECIMAL(8,2) DEFAULT 0,
    descripcion_tarea TEXT,
    dias_semana JSONB DEFAULT '[]',
    estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'en_progreso', 'pre_confirmado', 'completado')),
    fecha_respuesta TIMESTAMPTZ,
    motivo_rechazo TEXT,
    fecha_pre_confirmacion TIMESTAMPTZ,
    fecha_completado TIMESTAMPTZ,
    UNIQUE(id_solicitud, id_miembro)
);

-- Tabla de avances/comentarios por asignacion
CREATE TABLE IF NOT EXISTS paquete_avances (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_asignacion BIGINT REFERENCES paquete_asignaciones(id) ON DELETE CASCADE,
    autor_tipo VARCHAR(20) CHECK (autor_tipo IN ('miembro', 'cliente')),
    id_autor UUID REFERENCES user_profiles(id),
    contenido TEXT NOT NULL,
    imagenes JSONB DEFAULT '[]',
    horas_reportadas DECIMAL(5,2) DEFAULT 0,
    es_pre_confirmacion BOOLEAN DEFAULT FALSE
);

-- =====================================================
-- PASO 2: INDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_paquete_solicitudes_cliente ON paquete_solicitudes(id_cliente);
CREATE INDEX IF NOT EXISTS idx_paquete_solicitudes_estado ON paquete_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_paquete_asignaciones_solicitud ON paquete_asignaciones(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_paquete_asignaciones_miembro ON paquete_asignaciones(id_miembro);
CREATE INDEX IF NOT EXISTS idx_paquete_asignaciones_estado ON paquete_asignaciones(estado);
CREATE INDEX IF NOT EXISTS idx_paquete_avances_asignacion ON paquete_avances(id_asignacion);

-- =====================================================
-- PASO 3: TRIGGERS
-- =====================================================

-- Trigger 1: Recalcular horas_asignadas en solicitud cuando cambian asignaciones
CREATE OR REPLACE FUNCTION update_solicitud_horas_asignadas()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE paquete_solicitudes
    SET horas_asignadas = COALESCE((
        SELECT SUM(horas_asignadas) FROM paquete_asignaciones
        WHERE id_solicitud = COALESCE(NEW.id_solicitud, OLD.id_solicitud)
        AND estado != 'rechazado'
    ), 0)
    WHERE id = COALESCE(NEW.id_solicitud, OLD.id_solicitud);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_solicitud_horas ON paquete_asignaciones;
CREATE TRIGGER trigger_update_solicitud_horas
    AFTER INSERT OR UPDATE OR DELETE ON paquete_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_solicitud_horas_asignadas();

-- Trigger 2: Incrementar horas_consumidas al insertar avance con horas
CREATE OR REPLACE FUNCTION update_asignacion_horas_on_avance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.horas_reportadas > 0 THEN
        UPDATE paquete_asignaciones
        SET horas_consumidas = horas_consumidas + NEW.horas_reportadas
        WHERE id = NEW.id_asignacion;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_horas_on_avance ON paquete_avances;
CREATE TRIGGER trigger_update_horas_on_avance
    AFTER INSERT ON paquete_avances
    FOR EACH ROW
    EXECUTE FUNCTION update_asignacion_horas_on_avance();

-- Trigger 3: Auto-actualizar updated_at en paquete_solicitudes
CREATE OR REPLACE FUNCTION update_paquete_solicitudes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_paquete_solicitudes_updated_at ON paquete_solicitudes;
CREATE TRIGGER trigger_paquete_solicitudes_updated_at
    BEFORE UPDATE ON paquete_solicitudes
    FOR EACH ROW
    EXECUTE FUNCTION update_paquete_solicitudes_updated_at();

-- Auto-actualizar updated_at en paquete_asignaciones
CREATE OR REPLACE FUNCTION update_paquete_asignaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_paquete_asignaciones_updated_at ON paquete_asignaciones;
CREATE TRIGGER trigger_paquete_asignaciones_updated_at
    BEFORE UPDATE ON paquete_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION update_paquete_asignaciones_updated_at();

-- =====================================================
-- PASO 4: MIGRACION DE MODULOS (SECCIONES)
-- =====================================================

-- Agregar seccion "Paquetes" al modulo Gestion de Tickets (cliente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM modulos
        WHERE ruta = '/dashboard/tickets'
        AND secciones::text LIKE '%paquetes%'
    ) THEN
        UPDATE modulos
        SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "paquetes", "label": "Paquetes", "href": "/dashboard/tickets/paquetes", "icono": "package"}]'::jsonb
        WHERE ruta = '/dashboard/tickets';
        RAISE NOTICE 'Seccion Paquetes agregada al modulo Gestion de Tickets';
    ELSE
        RAISE NOTICE 'La seccion Paquetes ya existe en Gestion de Tickets';
    END IF;
END $$;

-- Agregar seccion "Paquetes" al modulo Mi Espacio (miembro)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM modulos
        WHERE ruta = '/dashboard/miembro'
        AND secciones::text LIKE '%mis-paquetes-v2%'
    ) THEN
        UPDATE modulos
        SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mis-paquetes-v2", "label": "Paquetes", "href": "/dashboard/miembro/paquetes", "icono": "package"}]'::jsonb
        WHERE ruta = '/dashboard/miembro';
        RAISE NOTICE 'Seccion Paquetes agregada al modulo Mi Espacio';
    ELSE
        RAISE NOTICE 'La seccion Paquetes ya existe en Mi Espacio';
    END IF;
END $$;

-- =====================================================
-- VERIFICACION
-- =====================================================
SELECT 'Tablas creadas:' as info;
SELECT table_name FROM information_schema.tables WHERE table_name IN ('paquete_solicitudes', 'paquete_asignaciones', 'paquete_avances');

SELECT 'Modulos actualizados:' as info;
SELECT nombre, secciones FROM modulos WHERE ruta IN ('/dashboard/tickets', '/dashboard/miembro');
