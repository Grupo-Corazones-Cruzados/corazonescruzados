-- =====================================================
-- MIGRACIÓN PARA RAILWAY POSTGRESQL
-- Adaptado de Supabase - Sin referencias a auth.users
-- =====================================================

-- =====================================================
-- FASE 1: TABLA DE USUARIOS CON AUTENTICACIÓN PROPIA
-- =====================================================

-- Crear extensión para UUID si no existe
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de perfiles de usuario con autenticación integrada
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre VARCHAR(255),
    apellido VARCHAR(255),
    avatar_url TEXT,
    telefono VARCHAR(50),
    rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('cliente', 'miembro', 'admin')),
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    verificado BOOLEAN DEFAULT FALSE,
    reset_token TEXT,
    reset_token_expires TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_miembro ON user_profiles(id_miembro);

COMMENT ON TABLE user_profiles IS 'Perfiles de usuario con autenticación JWT';

-- =====================================================
-- FASE 2: TABLAS BASE (clientes, miembros, acciones, tickets, modulos)
-- Estas tablas deben existir previamente o crearse aquí
-- =====================================================

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    correo_electronico VARCHAR(255) UNIQUE NOT NULL,
    telefono VARCHAR(50),
    empresa VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(correo_electronico);

-- Tabla de miembros
CREATE TABLE IF NOT EXISTS miembros (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    correo VARCHAR(255) UNIQUE,
    telefono VARCHAR(50),
    foto TEXT,
    puesto VARCHAR(255),
    costo DECIMAL(10,2),
    activo BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_miembros_activo ON miembros(activo);

-- Tabla de acciones/servicios
CREATE TABLE IF NOT EXISTS acciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio_base DECIMAL(10,2),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de módulos del dashboard
CREATE TABLE IF NOT EXISTS modulos (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    icono VARCHAR(100),
    ruta VARCHAR(255),
    orden INT DEFAULT 0,
    requiere_verificacion BOOLEAN DEFAULT FALSE,
    roles_permitidos TEXT[] DEFAULT ARRAY['cliente', 'miembro', 'admin']
);

-- Tabla de tickets
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
    id_accion BIGINT REFERENCES acciones(id) ON DELETE SET NULL,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    titulo VARCHAR(255),
    detalle TEXT,
    estado VARCHAR(30) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'en_progreso', 'completado', 'cancelado')),
    fecha_fin TIMESTAMPTZ,
    fecha_programada TIMESTAMPTZ,
    consumo DECIMAL(10,2),
    horas_estimadas DECIMAL(10,2),
    horas_reales DECIMAL(10,2),
    costo_estimado DECIMAL(10,2),
    costo_real DECIMAL(10,2),
    google_event_id VARCHAR(255),
    google_meet_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_cliente ON tickets(id_cliente);
CREATE INDEX IF NOT EXISTS idx_tickets_miembro ON tickets(id_miembro);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);

-- =====================================================
-- FASE 3: DISPONIBILIDAD DE MIEMBROS
-- =====================================================

-- Disponibilidad semanal de miembros
CREATE TABLE IF NOT EXISTS member_availability (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana >= 0 AND dia_semana <= 6), -- 0=Domingo, 6=Sábado
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT valid_hours CHECK (hora_inicio < hora_fin)
);

CREATE INDEX IF NOT EXISTS idx_member_availability_miembro ON member_availability(id_miembro);
CREATE INDEX IF NOT EXISTS idx_member_availability_dia ON member_availability(dia_semana);

-- Excepciones de disponibilidad (días bloqueados o disponibles extra)
CREATE TABLE IF NOT EXISTS availability_exceptions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('blocked', 'available')),
    motivo VARCHAR(255),
    hora_inicio TIME, -- Solo para tipo 'available'
    hora_fin TIME     -- Solo para tipo 'available'
);

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_miembro ON availability_exceptions(id_miembro);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_fecha ON availability_exceptions(fecha);

-- =====================================================
-- FASE 4: SLOTS Y ACCIONES DE TICKETS
-- =====================================================

-- Slots de tiempo reservados por ticket
CREATE TABLE IF NOT EXISTS ticket_slots (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_ticket BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'completado', 'cancelado')),
    duracion_real DECIMAL(10,2), -- Minutos reales trabajados
    notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticket_slots_ticket ON ticket_slots(id_ticket);
CREATE INDEX IF NOT EXISTS idx_ticket_slots_fecha ON ticket_slots(fecha);

-- Acciones múltiples asociadas a un ticket
CREATE TABLE IF NOT EXISTS ticket_acciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_ticket BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    id_accion BIGINT REFERENCES acciones(id) ON DELETE SET NULL,
    horas_asignadas DECIMAL(10,2) NOT NULL,
    costo_hora DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (horas_asignadas * costo_hora) STORED
);

CREATE INDEX IF NOT EXISTS idx_ticket_acciones_ticket ON ticket_acciones(id_ticket);

-- =====================================================
-- FASE 5: PROYECTOS Y POSTULACIONES
-- =====================================================

-- Proyectos publicados por clientes
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
    id_miembro_asignado BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    presupuesto_min DECIMAL(10,2),
    presupuesto_max DECIMAL(10,2),
    fecha_limite DATE,
    estado VARCHAR(30) DEFAULT 'publicado' CHECK (estado IN ('borrador', 'publicado', 'asignado', 'en_progreso', 'completado', 'cancelado')),
    CONSTRAINT valid_budget CHECK (presupuesto_min IS NULL OR presupuesto_max IS NULL OR presupuesto_min <= presupuesto_max)
);

CREATE INDEX IF NOT EXISTS idx_projects_cliente ON projects(id_cliente);
CREATE INDEX IF NOT EXISTS idx_projects_miembro ON projects(id_miembro_asignado);
CREATE INDEX IF NOT EXISTS idx_projects_estado ON projects(estado);

-- Postulaciones de miembros a proyectos
CREATE TABLE IF NOT EXISTS project_bids (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_project BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE CASCADE,
    propuesta TEXT NOT NULL,
    precio_ofertado DECIMAL(10,2) NOT NULL,
    tiempo_estimado_dias INT,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
    UNIQUE(id_project, id_miembro) -- Un miembro solo puede postular una vez por proyecto
);

CREATE INDEX IF NOT EXISTS idx_project_bids_project ON project_bids(id_project);
CREATE INDEX IF NOT EXISTS idx_project_bids_miembro ON project_bids(id_miembro);

-- Requerimientos del proyecto
CREATE TABLE IF NOT EXISTS project_requirements (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_project BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    costo DECIMAL(10,2),
    completado BOOLEAN DEFAULT FALSE,
    fecha_completado TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_requirements_project ON project_requirements(id_project);

-- =====================================================
-- FASE 6: FACTURACIÓN
-- =====================================================

-- Facturas
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    numero_factura VARCHAR(50) UNIQUE,
    id_cliente BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    id_ticket BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    id_project BIGINT REFERENCES projects(id) ON DELETE SET NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) GENERATED ALWAYS AS (subtotal + impuestos) STORED,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviada', 'pagada', 'cancelada')),
    pdf_url TEXT,
    notas TEXT,
    fecha_envio TIMESTAMPTZ,
    fecha_pago TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoices_cliente ON invoices(id_cliente);
CREATE INDEX IF NOT EXISTS idx_invoices_miembro ON invoices(id_miembro);
CREATE INDEX IF NOT EXISTS idx_invoices_estado ON invoices(estado);

-- Items de factura
CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_invoice BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
    descripcion VARCHAR(500) NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(id_invoice);

-- =====================================================
-- FASE 7: GOOGLE CALENDAR TOKENS
-- =====================================================

-- Tokens de Google Calendar para sincronización
CREATE TABLE IF NOT EXISTS google_tokens (
    id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    scope TEXT
);

-- =====================================================
-- FUNCIONES AUXILIARES
-- =====================================================

-- Función para generar número de factura
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
    year_month TEXT;
    seq_num INT;
    invoice_number TEXT;
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(numero_factura FROM 8) AS INT)
    ), 0) + 1
    INTO seq_num
    FROM invoices
    WHERE numero_factura LIKE 'INV' || year_month || '%';

    invoice_number := 'INV' || year_month || LPAD(seq_num::TEXT, 4, '0');

    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger para auto-generar número de factura
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_factura IS NULL OR NEW.numero_factura = '' THEN
        NEW.numero_factura := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_invoice_number ON invoices;
CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_google_tokens_updated_at ON google_tokens;
CREATE TRIGGER trigger_google_tokens_updated_at
    BEFORE UPDATE ON google_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INSERTAR MÓDULOS EN EL DASHBOARD
-- =====================================================

-- Módulo de Tickets
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
VALUES ('Gestión de Tickets', 'Crea y gestiona tickets de soporte. Reserva citas con miembros del equipo y da seguimiento a tus solicitudes.', 'ticket', '/dashboard/tickets', 1, true, ARRAY['cliente', 'miembro', 'admin'])
ON CONFLICT DO NOTHING;

-- Módulo de Proyectos
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
VALUES ('Proyectos', 'Publica proyectos y recibe postulaciones de miembros calificados. Gestiona el progreso y requerimientos.', 'proyecto', '/dashboard/projects', 3, true, ARRAY['cliente', 'miembro', 'admin'])
ON CONFLICT DO NOTHING;

-- Módulo de Facturas
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
VALUES ('Facturas', 'Consulta el historial de facturas, pagos pendientes y descarga comprobantes.', 'factura', '/dashboard/invoices', 4, true, ARRAY['cliente', 'miembro', 'admin'])
ON CONFLICT DO NOTHING;

-- Módulo de Configuración
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
VALUES ('Configuración', 'Administra tu perfil, disponibilidad y conexiones con servicios externos.', 'settings', '/dashboard/settings', 5, true, ARRAY['cliente', 'miembro', 'admin'])
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
