-- =====================================================
-- SCRIPT COMPLETO DE BASE DE DATOS - CORAZONES CRUZADOS
-- Para nueva instalacion en Railway PostgreSQL
-- =====================================================

-- Extension para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PASO 1: TABLAS BASE (sin dependencias)
-- =====================================================

-- Tabla: fuentes (categorias para acciones y puestos)
CREATE TABLE IF NOT EXISTS fuentes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255)
);

-- Tabla: paquetes
CREATE TABLE IF NOT EXISTS paquetes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    contenido VARCHAR(1000),
    horas BIGINT,
    descripcion VARCHAR(500),
    descuento BIGINT DEFAULT 0
);

-- Tabla: preguntas_frecuentes
CREATE TABLE IF NOT EXISTS preguntas_frecuentes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    pregunta VARCHAR(500),
    respuesta VARCHAR(2000),
    video_url TEXT
);

-- Tabla: pasos
CREATE TABLE IF NOT EXISTS pasos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

-- Tabla: pisos
CREATE TABLE IF NOT EXISTS pisos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

-- Tabla: aspirantes
CREATE TABLE IF NOT EXISTS aspirantes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    motivo VARCHAR(1000)
);

-- =====================================================
-- PASO 2: TABLAS CON DEPENDENCIAS SIMPLES
-- =====================================================

-- Tabla: miembros
CREATE TABLE IF NOT EXISTS miembros (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    puesto VARCHAR(255),
    descripcion VARCHAR(500),
    foto TEXT,
    costo BIGINT,
    correo VARCHAR(255),
    id_fuente BIGINT REFERENCES fuentes(id),
    cod_usuario VARCHAR(100),
    celular VARCHAR(50),
    restringido_proyectos BOOLEAN DEFAULT FALSE,
    motivo_restriccion TEXT,
    restringido_en TIMESTAMPTZ,
    id_paso BIGINT REFERENCES pasos(id),
    id_piso BIGINT REFERENCES pisos(id)
);

-- Tabla: user_profiles (autenticacion)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255),
    apellido VARCHAR(255),
    avatar_url TEXT,
    telefono VARCHAR(50),
    rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('cliente', 'miembro', 'admin')),
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    verificado BOOLEAN DEFAULT FALSE,
    email_verificado_at TIMESTAMPTZ,
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido', 'baneado')),
    last_login TIMESTAMPTZ,
    last_ip VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_rol ON user_profiles(rol);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_miembro ON user_profiles(id_miembro);

-- Tabla: verification_tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'email_verification',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);

-- Tabla: blocked_ips
CREATE TABLE IF NOT EXISTS blocked_ips (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    user_id UUID REFERENCES user_profiles(id),
    motivo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);

-- Tabla: acciones
CREATE TABLE IF NOT EXISTS acciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    id_miembro BIGINT REFERENCES miembros(id),
    id_fuente BIGINT REFERENCES fuentes(id)
);

-- Tabla: clientes
CREATE TABLE IF NOT EXISTS clientes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    contacto VARCHAR(255),
    correo_electronico VARCHAR(255),
    id_miembro BIGINT REFERENCES miembros(id),
    id_accion BIGINT REFERENCES acciones(id)
);

-- =====================================================
-- PASO 3: TICKETS Y RELACIONADOS
-- =====================================================

-- Tabla: tickets
CREATE TABLE IF NOT EXISTS tickets (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente BIGINT REFERENCES clientes(id),
    id_miembro BIGINT REFERENCES miembros(id),
    id_accion BIGINT REFERENCES acciones(id),
    titulo VARCHAR(255),
    detalle VARCHAR(1000),
    estado VARCHAR(50) DEFAULT 'pendiente',
    horas_estimadas DECIMAL(10,2),
    horas_reales DECIMAL(10,2),
    costo_estimado DECIMAL(10,2),
    costo_real DECIMAL(10,2),
    fecha_programada TIMESTAMPTZ,
    fecha_fin DATE,
    consumo BIGINT,
    google_event_id VARCHAR(255),
    google_meet_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_miembro ON tickets(id_miembro);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);

-- Tabla: ticket_slots
CREATE TABLE IF NOT EXISTS ticket_slots (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_ticket BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'completado', 'cancelado')),
    duracion_real DECIMAL(10,2),
    notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticket_slots_ticket ON ticket_slots(id_ticket);
CREATE INDEX IF NOT EXISTS idx_ticket_slots_fecha ON ticket_slots(fecha);

-- Tabla: ticket_acciones
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

-- Tabla: tickets_paquetes
CREATE TABLE IF NOT EXISTS tickets_paquetes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_paquete BIGINT REFERENCES paquetes(id),
    id_miembro BIGINT REFERENCES miembros(id),
    id_cliente BIGINT REFERENCES clientes(id)
);

-- =====================================================
-- PASO 4: DISPONIBILIDAD DE MIEMBROS
-- =====================================================

-- Disponibilidad semanal de miembros
CREATE TABLE IF NOT EXISTS member_availability (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE CASCADE,
    dia_semana INT CHECK (dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT valid_hours CHECK (hora_inicio < hora_fin)
);

CREATE INDEX IF NOT EXISTS idx_member_availability_miembro ON member_availability(id_miembro);
CREATE INDEX IF NOT EXISTS idx_member_availability_dia ON member_availability(dia_semana);

-- Excepciones de disponibilidad
CREATE TABLE IF NOT EXISTS availability_exceptions (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('blocked', 'available')),
    motivo VARCHAR(255),
    hora_inicio TIME,
    hora_fin TIME
);

CREATE INDEX IF NOT EXISTS idx_availability_exceptions_miembro ON availability_exceptions(id_miembro);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_fecha ON availability_exceptions(fecha);

-- =====================================================
-- PASO 5: PROYECTOS Y POSTULACIONES
-- =====================================================

-- Tabla: projects
CREATE TABLE IF NOT EXISTS projects (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
    id_miembro_asignado BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    id_miembro_propietario BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    presupuesto_min DECIMAL(10,2),
    presupuesto_max DECIMAL(10,2),
    fecha_limite DATE,
    estado VARCHAR(30) DEFAULT 'publicado',
    justificacion_cierre TEXT,
    cerrado_por VARCHAR(10),
    republicado BOOLEAN DEFAULT FALSE,
    tipo_proyecto VARCHAR(20) DEFAULT 'cliente',
    visibilidad VARCHAR(20) DEFAULT 'privado',
    CONSTRAINT valid_budget CHECK (presupuesto_min IS NULL OR presupuesto_max IS NULL OR presupuesto_min <= presupuesto_max),
    CONSTRAINT projects_estado_check CHECK (estado IN (
        'borrador', 'publicado', 'planificado', 'en_progreso', 'completado',
        'completado_parcial', 'no_completado', 'cancelado', 'cancelado_sin_acuerdo',
        'cancelado_sin_presupuesto', 'no_pagado', 'no_completado_por_miembro'
    )),
    CONSTRAINT projects_tipo_proyecto_check CHECK (tipo_proyecto IN ('cliente', 'miembro')),
    CONSTRAINT projects_visibilidad_check CHECK (visibilidad IN ('privado', 'publico')),
    CONSTRAINT check_owner_exists CHECK (id_cliente IS NOT NULL OR id_miembro_propietario IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_projects_cliente ON projects(id_cliente);
CREATE INDEX IF NOT EXISTS idx_projects_miembro ON projects(id_miembro_asignado);
CREATE INDEX IF NOT EXISTS idx_projects_estado ON projects(estado);
CREATE INDEX IF NOT EXISTS idx_projects_miembro_propietario ON projects(id_miembro_propietario);
CREATE INDEX IF NOT EXISTS idx_projects_visibilidad ON projects(visibilidad);
CREATE INDEX IF NOT EXISTS idx_projects_tipo_proyecto ON projects(tipo_proyecto);

-- Tabla: project_bids (postulaciones)
CREATE TABLE IF NOT EXISTS project_bids (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_project BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE CASCADE,
    propuesta TEXT NOT NULL,
    precio_ofertado DECIMAL(10,2) NOT NULL,
    tiempo_estimado_dias INT,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
    imagenes JSONB DEFAULT '[]'::jsonb,
    monto_acordado NUMERIC(12,2),
    fecha_aceptacion TIMESTAMPTZ,
    confirmado_por_miembro BOOLEAN,
    fecha_confirmacion TIMESTAMPTZ,
    trabajo_finalizado BOOLEAN DEFAULT FALSE,
    fecha_trabajo_finalizado TIMESTAMPTZ,
    UNIQUE(id_project, id_miembro)
);

CREATE INDEX IF NOT EXISTS idx_project_bids_project ON project_bids(id_project);
CREATE INDEX IF NOT EXISTS idx_project_bids_miembro ON project_bids(id_miembro);
CREATE INDEX IF NOT EXISTS idx_project_bids_fecha_aceptacion ON project_bids(fecha_aceptacion)
    WHERE estado = 'aceptada' AND confirmado_por_miembro IS NULL;

-- Tabla: project_requirements (requerimientos)
CREATE TABLE IF NOT EXISTS project_requirements (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_project BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    costo DECIMAL(10,2),
    completado BOOLEAN DEFAULT FALSE,
    fecha_completado TIMESTAMPTZ,
    creado_por VARCHAR(10) DEFAULT 'cliente',
    es_adicional BOOLEAN DEFAULT FALSE,
    completado_por INTEGER REFERENCES miembros(id),
    creado_por_miembro_id INTEGER REFERENCES miembros(id),
    creado_por_cliente_id INTEGER REFERENCES clientes(id)
);

CREATE INDEX IF NOT EXISTS idx_project_requirements_project ON project_requirements(id_project);

-- =====================================================
-- PASO 6: FACTURACION
-- =====================================================

-- Tabla: invoices
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
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

-- Tabla: invoice_items
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
-- PASO 7: PRODUCTOS Y MERCADO
-- =====================================================

-- Tabla: productos
CREATE TABLE IF NOT EXISTS productos (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    nombre TEXT,
    herramientas JSONB,
    descripcion TEXT,
    costo INTEGER,
    imagen TEXT,
    imagenes JSONB DEFAULT '[]'::jsonb,
    categoria VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    id_miembro BIGINT REFERENCES miembros(id),
    link_detalles TEXT,
    unico BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_id_miembro ON productos(id_miembro);

-- Tabla: cart_items (carrito)
CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    id_usuario UUID NOT NULL,
    id_producto BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id_usuario, id_producto)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_usuario ON cart_items(id_usuario);

-- Tabla: orders (pedidos)
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    id_comprador UUID NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    notas TEXT,
    paypal_order_id VARCHAR(255),
    paypal_capture_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_comprador ON orders(id_comprador);
CREATE INDEX IF NOT EXISTS idx_orders_estado ON orders(estado);

-- Tabla: order_items
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    id_order BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    id_producto BIGINT NOT NULL REFERENCES productos(id),
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(id_order);

-- =====================================================
-- PASO 8: MODULOS Y DASHBOARD
-- =====================================================

-- Tabla: modulos
CREATE TABLE IF NOT EXISTS modulos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    icono VARCHAR(50),
    ruta VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    requiere_verificacion BOOLEAN DEFAULT TRUE,
    roles_permitidos TEXT[] DEFAULT ARRAY['cliente', 'miembro', 'admin'],
    secciones JSONB DEFAULT '[]'::jsonb
);

-- =====================================================
-- PASO 9: FUNCIONES Y TRIGGERS
-- =====================================================

-- Funcion para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para projects
DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para invoices
DROP TRIGGER IF EXISTS trigger_invoices_updated_at ON invoices;
CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para productos
CREATE OR REPLACE FUNCTION update_productos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_productos_updated_at ON productos;
CREATE TRIGGER trigger_productos_updated_at
    BEFORE UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION update_productos_updated_at();

-- Trigger para cart_items
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cart_items_updated_at ON cart_items;
CREATE TRIGGER trigger_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_cart_items_updated_at();

-- Trigger para orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Funcion para generar numero de factura
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

-- Trigger para auto-generar numero de factura
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

-- =====================================================
-- PASO 9B: TABLAS PAQUETE SOLICITUDES (MULTI-MIEMBRO)
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

-- Indices
CREATE INDEX IF NOT EXISTS idx_paquete_solicitudes_cliente ON paquete_solicitudes(id_cliente);
CREATE INDEX IF NOT EXISTS idx_paquete_solicitudes_estado ON paquete_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_paquete_asignaciones_solicitud ON paquete_asignaciones(id_solicitud);
CREATE INDEX IF NOT EXISTS idx_paquete_asignaciones_miembro ON paquete_asignaciones(id_miembro);
CREATE INDEX IF NOT EXISTS idx_paquete_asignaciones_estado ON paquete_asignaciones(estado);
CREATE INDEX IF NOT EXISTS idx_paquete_avances_asignacion ON paquete_avances(id_asignacion);

-- Triggers paquete_solicitudes
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
-- PASO 10: DATOS INICIALES
-- =====================================================

-- Fuentes de ejemplo
INSERT INTO fuentes (nombre) VALUES
    ('Desarrollo Web'),
    ('Diseno Grafico'),
    ('Marketing Digital'),
    ('Consultoria')
ON CONFLICT DO NOTHING;

-- Paquetes de ejemplo
INSERT INTO paquetes (nombre, contenido, horas, descripcion, descuento) VALUES
    ('Paquete Basico', 'Consulta inicial;Analisis de requerimientos;Propuesta de solucion;Soporte por email', 10, 'Ideal para proyectos pequenos o consultas puntuales.', 0),
    ('Paquete Profesional', 'Todo del paquete basico;Desarrollo personalizado;Revisiones ilimitadas;Soporte prioritario;Capacitacion basica', 25, 'Perfecto para proyectos medianos que requieren atencion dedicada.', 10),
    ('Paquete Premium', 'Todo del paquete profesional;Gerente de proyecto dedicado;Soporte 24/7;Mantenimiento por 3 meses;Capacitacion avanzada;Reportes semanales', 50, 'La mejor opcion para proyectos empresariales y de largo plazo.', 20)
ON CONFLICT DO NOTHING;

-- Modulos del dashboard
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, secciones) VALUES
    ('Gestión de Tickets', 'Crea y gestiona tickets de soporte. Realiza seguimiento de tus solicitudes.', 'tickets', '/dashboard/tickets', 1, true, ARRAY['cliente', 'miembro', 'admin'], '[{"id": "tickets", "label": "Mis Tickets", "href": "/dashboard/tickets", "icono": "ticket"}, {"id": "nuevo", "label": "Nuevo Ticket", "href": "/dashboard/tickets/new", "icono": "plus"}, {"id": "proyectos", "label": "Proyectos", "href": "/dashboard/projects", "icono": "folder"}, {"id": "paquetes", "label": "Paquetes", "href": "/dashboard/tickets/paquetes", "icono": "package"}]'::jsonb),
    ('Proyecto Centralizado', 'Accede al centro de proyectos. Visualiza el progreso y colabora.', 'proyecto', '/dashboard/proyecto', 2, true, ARRAY['cliente', 'miembro', 'admin'], '[{"id": "reclutamiento", "label": "Reclutamiento y Seleccion", "href": "/dashboard/proyecto/reclutamiento", "icono": "users"}]'::jsonb),
    ('Mercado', 'Explora productos y servicios disponibles.', 'mercado', '/dashboard/mercado', 3, false, ARRAY['cliente', 'miembro', 'admin'], '[]'::jsonb),
    ('Administracion', 'Panel de administracion del sistema.', 'admin', '/dashboard/admin', 4, true, ARRAY['admin'], '[{"id": "usuarios", "label": "Usuarios", "href": "/dashboard/admin", "icono": "users"}, {"id": "miembros", "label": "Miembros", "href": "/dashboard/admin/miembros", "icono": "user-check"}]'::jsonb)
ON CONFLICT DO NOTHING;

-- Preguntas frecuentes
INSERT INTO preguntas_frecuentes (pregunta, respuesta) VALUES
    ('Como puedo solicitar un servicio?', 'Puedes solicitar un servicio seleccionando el paquete que mejor se adapte a tus necesidades, eligiendo un miembro del equipo y completando el formulario de solicitud.'),
    ('Cuales son los metodos de pago?', 'Aceptamos transferencias bancarias, tarjetas de credito/debito y PayPal. El pago se realiza una vez aprobada la propuesta.'),
    ('Cuanto tiempo toma completar un proyecto?', 'El tiempo varia segun la complejidad del proyecto. En la consulta inicial te proporcionaremos un estimado detallado.')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
SELECT 'Base de datos configurada correctamente!' as resultado;
