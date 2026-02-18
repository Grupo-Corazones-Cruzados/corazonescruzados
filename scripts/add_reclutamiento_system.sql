-- =====================================================
-- MIGRACIÓN: Sistema de Reclutamiento y Selección
-- Tablas para postulaciones, eventos, puntuaciones y restricciones
-- =====================================================

-- Postulaciones (usuarios autenticados, una por usuario)
CREATE TABLE IF NOT EXISTS postulaciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_usuario UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    motivo VARCHAR(2000) NOT NULL,
    UNIQUE(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_postulaciones_usuario ON postulaciones(id_usuario);

-- Eventos de reclutamiento
CREATE TABLE IF NOT EXISTS eventos_reclutamiento (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion VARCHAR(2000),
    fecha TIMESTAMPTZ NOT NULL,
    id_creador UUID NOT NULL REFERENCES user_profiles(id),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado', 'cancelado'))
);

CREATE INDEX IF NOT EXISTS idx_eventos_reclutamiento_estado ON eventos_reclutamiento(estado);
CREATE INDEX IF NOT EXISTS idx_eventos_reclutamiento_fecha ON eventos_reclutamiento(fecha);

-- Invitaciones a eventos (con tracking de participación)
CREATE TABLE IF NOT EXISTS evento_invitaciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_evento BIGINT NOT NULL REFERENCES eventos_reclutamiento(id) ON DELETE CASCADE,
    id_postulacion BIGINT NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    invitado_por UUID NOT NULL REFERENCES user_profiles(id),
    participo BOOLEAN DEFAULT FALSE,
    UNIQUE(id_evento, id_postulacion)
);

CREATE INDEX IF NOT EXISTS idx_evento_invitaciones_evento ON evento_invitaciones(id_evento);
CREATE INDEX IF NOT EXISTS idx_evento_invitaciones_postulacion ON evento_invitaciones(id_postulacion);

-- Puntuaciones del Encuadre Cruzado (9 criterios, 1-10)
CREATE TABLE IF NOT EXISTS evento_puntuaciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_invitacion BIGINT NOT NULL REFERENCES evento_invitaciones(id) ON DELETE CASCADE,
    evaluado_por UUID NOT NULL REFERENCES user_profiles(id),
    valor INT CHECK (valor BETWEEN 1 AND 10),
    coraje INT CHECK (coraje BETWEEN 1 AND 10),
    pureza INT CHECK (pureza BETWEEN 1 AND 10),
    fe INT CHECK (fe BETWEEN 1 AND 10),
    paciencia INT CHECK (paciencia BETWEEN 1 AND 10),
    seriedad INT CHECK (seriedad BETWEEN 1 AND 10),
    empatia INT CHECK (empatia BETWEEN 1 AND 10),
    espontaneidad INT CHECK (espontaneidad BETWEEN 1 AND 10),
    autonomia INT CHECK (autonomia BETWEEN 1 AND 10),
    UNIQUE(id_invitacion, evaluado_por)
);

CREATE INDEX IF NOT EXISTS idx_evento_puntuaciones_invitacion ON evento_puntuaciones(id_invitacion);

-- Restricciones (permanentes por admin, temporales por reclutador)
CREATE TABLE IF NOT EXISTS restricciones_reclutamiento (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_postulacion BIGINT NOT NULL REFERENCES postulaciones(id) ON DELETE CASCADE,
    restringido_por UUID NOT NULL REFERENCES user_profiles(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('permanente', 'temporal')),
    motivo VARCHAR(1000),
    dias INT,
    fecha_expiracion TIMESTAMPTZ,
    levantado BOOLEAN DEFAULT FALSE,
    levantado_por UUID REFERENCES user_profiles(id),
    levantado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_restricciones_postulacion ON restricciones_reclutamiento(id_postulacion);

SELECT 'Tablas de reclutamiento creadas correctamente!' as resultado;
