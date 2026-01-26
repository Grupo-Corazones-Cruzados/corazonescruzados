-- =====================================================
-- MÓDULO DE GESTIÓN DE TICKETS - MIGRACIÓN
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- FASE 1: MODIFICACIONES A TABLA TICKETS EXISTENTE
-- =====================================================

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS id_miembro BIGINT REFERENCES miembros(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS titulo VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS horas_estimadas DECIMAL(10,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS horas_reales DECIMAL(10,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS costo_estimado DECIMAL(10,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS costo_real DECIMAL(10,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS fecha_programada TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS google_meet_link TEXT;

-- =====================================================
-- FASE 2: DISPONIBILIDAD DE MIEMBROS
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

COMMENT ON TABLE member_availability IS 'Disponibilidad semanal recurrente de miembros';
COMMENT ON COLUMN member_availability.dia_semana IS '0=Domingo, 1=Lunes, ..., 6=Sábado';

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

COMMENT ON TABLE availability_exceptions IS 'Excepciones puntuales a la disponibilidad regular';

-- =====================================================
-- FASE 3: SLOTS Y ACCIONES DE TICKETS
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

COMMENT ON TABLE ticket_slots IS 'Slots de tiempo reservados para cada ticket';

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

COMMENT ON TABLE ticket_acciones IS 'Acciones/servicios incluidos en cada ticket con su cotización';

-- =====================================================
-- FASE 4: PROYECTOS Y POSTULACIONES
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

COMMENT ON TABLE projects IS 'Proyectos publicados por clientes para recibir postulaciones';

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

COMMENT ON TABLE project_bids IS 'Postulaciones de miembros a proyectos';

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

COMMENT ON TABLE project_requirements IS 'Requerimientos individuales de cada proyecto';

-- =====================================================
-- FASE 5: FACTURACIÓN
-- =====================================================

-- Facturas
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

COMMENT ON TABLE invoices IS 'Facturas generadas por tickets o proyectos completados';

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

COMMENT ON TABLE invoice_items IS 'Items individuales de cada factura';

-- =====================================================
-- FASE 6: GOOGLE CALENDAR TOKENS
-- =====================================================

-- Tokens de Google Calendar para sincronización
CREATE TABLE IF NOT EXISTS google_tokens (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date BIGINT,
    scope TEXT
);

COMMENT ON TABLE google_tokens IS 'Tokens OAuth de Google Calendar por usuario';

-- =====================================================
-- ÍNDICES PARA RENDIMIENTO
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_member_availability_miembro ON member_availability(id_miembro);
CREATE INDEX IF NOT EXISTS idx_member_availability_dia ON member_availability(dia_semana);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_miembro ON availability_exceptions(id_miembro);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_fecha ON availability_exceptions(fecha);
CREATE INDEX IF NOT EXISTS idx_ticket_slots_ticket ON ticket_slots(id_ticket);
CREATE INDEX IF NOT EXISTS idx_ticket_slots_fecha ON ticket_slots(fecha);
CREATE INDEX IF NOT EXISTS idx_ticket_acciones_ticket ON ticket_acciones(id_ticket);
CREATE INDEX IF NOT EXISTS idx_tickets_miembro ON tickets(id_miembro);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_projects_cliente ON projects(id_cliente);
CREATE INDEX IF NOT EXISTS idx_projects_miembro ON projects(id_miembro_asignado);
CREATE INDEX IF NOT EXISTS idx_projects_estado ON projects(estado);
CREATE INDEX IF NOT EXISTS idx_project_bids_project ON project_bids(id_project);
CREATE INDEX IF NOT EXISTS idx_project_bids_miembro ON project_bids(id_miembro);
CREATE INDEX IF NOT EXISTS idx_project_requirements_project ON project_requirements(id_project);
CREATE INDEX IF NOT EXISTS idx_invoices_cliente ON invoices(id_cliente);
CREATE INDEX IF NOT EXISTS idx_invoices_miembro ON invoices(id_miembro);
CREATE INDEX IF NOT EXISTS idx_invoices_estado ON invoices(estado);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(id_invoice);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas nuevas
ALTER TABLE member_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_acciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas para member_availability
CREATE POLICY "Miembros pueden ver toda la disponibilidad" ON member_availability
    FOR SELECT USING (true);

CREATE POLICY "Miembros pueden gestionar su disponibilidad" ON member_availability
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.id_miembro = member_availability.id_miembro
        )
    );

-- Políticas para availability_exceptions
CREATE POLICY "Todos pueden ver excepciones" ON availability_exceptions
    FOR SELECT USING (true);

CREATE POLICY "Miembros pueden gestionar sus excepciones" ON availability_exceptions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.id_miembro = availability_exceptions.id_miembro
        )
    );

-- Políticas para ticket_slots
CREATE POLICY "Usuarios pueden ver slots de sus tickets" ON ticket_slots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN clientes c ON t.id_cliente = c.id
            JOIN user_profiles up ON up.id = auth.uid()
            WHERE t.id = ticket_slots.id_ticket
            AND (
                up.id_miembro = t.id_miembro -- Es el miembro asignado
                OR c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid()) -- Es el cliente
                OR up.rol = 'admin'
            )
        )
    );

CREATE POLICY "Miembros pueden gestionar slots de sus tickets" ON ticket_slots
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN user_profiles up ON up.id = auth.uid()
            WHERE t.id = ticket_slots.id_ticket
            AND (up.id_miembro = t.id_miembro OR up.rol = 'admin')
        )
    );

-- Políticas para ticket_acciones
CREATE POLICY "Usuarios pueden ver acciones de sus tickets" ON ticket_acciones
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN clientes c ON t.id_cliente = c.id
            JOIN user_profiles up ON up.id = auth.uid()
            WHERE t.id = ticket_acciones.id_ticket
            AND (
                up.id_miembro = t.id_miembro
                OR c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
                OR up.rol = 'admin'
            )
        )
    );

CREATE POLICY "Miembros pueden gestionar acciones" ON ticket_acciones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM tickets t
            JOIN user_profiles up ON up.id = auth.uid()
            WHERE t.id = ticket_acciones.id_ticket
            AND (up.id_miembro = t.id_miembro OR up.rol = 'admin')
        )
    );

-- Políticas para projects
CREATE POLICY "Proyectos publicados son visibles para todos" ON projects
    FOR SELECT USING (estado = 'publicado' OR estado = 'asignado' OR estado = 'en_progreso');

CREATE POLICY "Clientes pueden ver sus proyectos" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes c
            WHERE c.id = projects.id_cliente
            AND c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Miembros asignados pueden ver el proyecto" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.id_miembro = projects.id_miembro_asignado
        )
    );

CREATE POLICY "Clientes pueden crear y gestionar sus proyectos" ON projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM clientes c
            WHERE c.id = projects.id_cliente
            AND c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Admins pueden gestionar todos los proyectos" ON projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.rol = 'admin'
        )
    );

-- Políticas para project_bids
CREATE POLICY "Clientes pueden ver postulaciones de sus proyectos" ON project_bids
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN clientes c ON c.id = p.id_cliente
            WHERE p.id = project_bids.id_project
            AND c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Miembros pueden ver y gestionar sus postulaciones" ON project_bids
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.id_miembro = project_bids.id_miembro
        )
    );

CREATE POLICY "Admins pueden ver todas las postulaciones" ON project_bids
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid() AND up.rol = 'admin'
        )
    );

-- Políticas para project_requirements
CREATE POLICY "Ver requerimientos de proyecto" ON project_requirements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM projects p
            LEFT JOIN clientes c ON c.id = p.id_cliente
            LEFT JOIN user_profiles up ON up.id = auth.uid()
            WHERE p.id = project_requirements.id_project
            AND (
                up.id_miembro = p.id_miembro_asignado
                OR c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
                OR up.rol = 'admin'
            )
        )
    );

CREATE POLICY "Miembros asignados pueden gestionar requerimientos" ON project_requirements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects p
            JOIN user_profiles up ON up.id = auth.uid()
            WHERE p.id = project_requirements.id_project
            AND (up.id_miembro = p.id_miembro_asignado OR up.rol = 'admin')
        )
    );

-- Políticas para invoices
CREATE POLICY "Clientes pueden ver sus facturas" ON invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes c
            WHERE c.id = invoices.id_cliente
            AND c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Miembros pueden ver y gestionar facturas que generaron" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND (up.id_miembro = invoices.id_miembro OR up.rol = 'admin')
        )
    );

-- Políticas para invoice_items
CREATE POLICY "Ver items de facturas accesibles" ON invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM invoices i
            LEFT JOIN clientes c ON c.id = i.id_cliente
            LEFT JOIN user_profiles up ON up.id = auth.uid()
            WHERE i.id = invoice_items.id_invoice
            AND (
                up.id_miembro = i.id_miembro
                OR c.correo_electronico = (SELECT email FROM auth.users WHERE id = auth.uid())
                OR up.rol = 'admin'
            )
        )
    );

CREATE POLICY "Miembros pueden gestionar items de sus facturas" ON invoice_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM invoices i
            JOIN user_profiles up ON up.id = auth.uid()
            WHERE i.id = invoice_items.id_invoice
            AND (up.id_miembro = i.id_miembro OR up.rol = 'admin')
        )
    );

-- Políticas para google_tokens (solo el usuario propietario)
CREATE POLICY "Usuarios solo ven sus propios tokens" ON google_tokens
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Usuarios solo gestionan sus propios tokens" ON google_tokens
    FOR ALL USING (id = auth.uid());

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
-- INSERTAR/ACTUALIZAR MÓDULOS EN EL DASHBOARD
-- =====================================================

-- Actualizar el módulo de Tickets existente
UPDATE modulos
SET ruta = '/dashboard/tickets',
    descripcion = 'Crea y gestiona tickets de soporte. Reserva citas con miembros del equipo y da seguimiento a tus solicitudes.'
WHERE nombre = 'Gestión de Tickets';

-- Insertar módulo de Proyectos si no existe
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
SELECT
    'Proyectos',
    'Publica proyectos y recibe postulaciones de miembros calificados. Gestiona el progreso y requerimientos.',
    'proyecto',
    '/dashboard/projects',
    3,
    true,
    ARRAY['cliente', 'miembro', 'admin']
WHERE NOT EXISTS (
    SELECT 1 FROM modulos WHERE nombre = 'Proyectos'
);

-- Insertar módulo de Facturas si no existe
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
SELECT
    'Facturas',
    'Consulta el historial de facturas, pagos pendientes y descarga comprobantes.',
    'factura',
    '/dashboard/invoices',
    4,
    true,
    ARRAY['cliente', 'miembro', 'admin']
WHERE NOT EXISTS (
    SELECT 1 FROM modulos WHERE nombre = 'Facturas'
);

-- Insertar módulo de Configuración si no existe
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos)
SELECT
    'Configuración',
    'Administra tu perfil, disponibilidad y conexiones con servicios externos.',
    'settings',
    '/dashboard/settings',
    5,
    true,
    ARRAY['cliente', 'miembro', 'admin']
WHERE NOT EXISTS (
    SELECT 1 FROM modulos WHERE nombre = 'Configuración'
);

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
