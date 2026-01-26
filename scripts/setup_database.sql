-- =====================================================
-- SCRIPT DE CONFIGURACIÓN INICIAL DE BASE DE DATOS
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- PASO 0: ELIMINAR TABLAS EXISTENTES (en orden por dependencias)
-- =====================================================
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS ticket_acciones CASCADE;
DROP TABLE IF EXISTS ticket_slots CASCADE;
DROP TABLE IF EXISTS tickets_paquetes CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS acciones CASCADE;
DROP TABLE IF EXISTS miembros CASCADE;
DROP TABLE IF EXISTS paquetes CASCADE;
DROP TABLE IF EXISTS fuentes CASCADE;
DROP TABLE IF EXISTS aspirantes CASCADE;
DROP TABLE IF EXISTS preguntas_frecuentes CASCADE;

-- Extensión para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- PASO 1: CREAR TABLAS BASE
-- =====================================================

-- Tabla: fuentes (categorías para acciones y puestos)
CREATE TABLE fuentes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255)
);

-- Tabla: paquetes
CREATE TABLE paquetes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    contenido VARCHAR(1000),
    horas BIGINT,
    descripcion VARCHAR(500),
    descuento BIGINT DEFAULT 0
);

-- Tabla: miembros
CREATE TABLE miembros (
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
    celular VARCHAR(50)
);

-- Tabla: user_profiles (autenticación y perfiles de usuario)
CREATE TABLE user_profiles (
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
    verificado BOOLEAN DEFAULT FALSE
);

-- Índices para user_profiles
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_rol ON user_profiles(rol);

-- Tabla: acciones
CREATE TABLE acciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    id_miembro BIGINT REFERENCES miembros(id),
    id_fuente BIGINT REFERENCES fuentes(id)
);

-- Tabla: clientes
CREATE TABLE clientes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    contacto VARCHAR(255),
    correo_electronico VARCHAR(255),
    id_miembro BIGINT REFERENCES miembros(id),
    id_accion BIGINT REFERENCES acciones(id)
);

-- Tabla: tickets
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente BIGINT REFERENCES clientes(id),
    id_miembro BIGINT REFERENCES miembros(id),
    id_accion BIGINT REFERENCES acciones(id),
    titulo VARCHAR(255),
    detalle VARCHAR(1000),
    estado VARCHAR(50) DEFAULT 'pendiente',
    horas_estimadas DECIMAL(10,2),
    costo_estimado DECIMAL(10,2),
    fecha_programada DATE,
    fecha_fin DATE,
    consumo BIGINT
);

-- Tabla: ticket_slots (horarios para tickets)
CREATE TABLE ticket_slots (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_ticket BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    fecha DATE,
    hora_inicio TIME,
    hora_fin TIME,
    estado VARCHAR(50) DEFAULT 'pendiente'
);

-- Tabla: ticket_acciones (acciones asociadas a tickets)
CREATE TABLE ticket_acciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_ticket BIGINT REFERENCES tickets(id) ON DELETE CASCADE,
    id_accion BIGINT REFERENCES acciones(id),
    horas_asignadas DECIMAL(10,2),
    costo_hora DECIMAL(10,2)
);

-- Tabla: tickets_paquetes
CREATE TABLE tickets_paquetes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_paquete BIGINT REFERENCES paquetes(id),
    id_miembro BIGINT REFERENCES miembros(id),
    id_cliente BIGINT REFERENCES clientes(id)
);

-- Tabla: aspirantes
CREATE TABLE aspirantes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    motivo VARCHAR(1000)
);

-- Tabla: preguntas_frecuentes
CREATE TABLE preguntas_frecuentes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    pregunta VARCHAR(500),
    respuesta VARCHAR(2000),
    video_url TEXT
);

-- Tabla: productos
CREATE TABLE productos (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre TEXT,
    herramientas JSONB,
    descripcion TEXT,
    costo INTEGER,
    imagen TEXT,
    id_miembro BIGINT REFERENCES miembros(id),
    link_detalles TEXT
);

-- =====================================================
-- PASO 2: INSERTAR DATOS DE EJEMPLO
-- =====================================================

-- Fuentes de ejemplo
INSERT INTO fuentes (nombre) VALUES
    ('Desarrollo Web'),
    ('Diseño Gráfico'),
    ('Marketing Digital'),
    ('Consultoría');

-- Paquetes de ejemplo
INSERT INTO paquetes (nombre, contenido, horas, descripcion, descuento) VALUES
    (
        'Paquete Básico',
        'Consulta inicial;Análisis de requerimientos;Propuesta de solución;Soporte por email',
        10,
        'Ideal para proyectos pequeños o consultas puntuales.',
        0
    ),
    (
        'Paquete Profesional',
        'Todo del paquete básico;Desarrollo personalizado;Revisiones ilimitadas;Soporte prioritario;Capacitación básica',
        25,
        'Perfecto para proyectos medianos que requieren atención dedicada.',
        10
    ),
    (
        'Paquete Premium',
        'Todo del paquete profesional;Gerente de proyecto dedicado;Soporte 24/7;Mantenimiento por 3 meses;Capacitación avanzada;Reportes semanales',
        50,
        'La mejor opción para proyectos empresariales y de largo plazo.',
        20
    );

-- Miembros de ejemplo
INSERT INTO miembros (nombre, puesto, descripcion, costo, correo, id_fuente) VALUES
    (
        'María García',
        'Desarrolladora Full Stack',
        'Especialista en React, Node.js y bases de datos. Más de 5 años de experiencia en desarrollo web.',
        50,
        'maria@ejemplo.com',
        1
    ),
    (
        'Carlos López',
        'Diseñador UX/UI',
        'Experto en diseño de interfaces y experiencia de usuario. Apasionado por crear productos digitales intuitivos.',
        45,
        'carlos@ejemplo.com',
        2
    ),
    (
        'Ana Martínez',
        'Consultora de Marketing',
        'Estratega digital con experiencia en campañas de alto impacto y análisis de datos.',
        55,
        'ana@ejemplo.com',
        3
    );

-- Acciones de ejemplo (servicios por miembro)
INSERT INTO acciones (nombre, id_miembro, id_fuente) VALUES
    ('Desarrollo de aplicación web', 1, 1),
    ('Mantenimiento de sitio web', 1, 1),
    ('Diseño de interfaz', 2, 2),
    ('Rediseño de marca', 2, 2),
    ('Estrategia de redes sociales', 3, 3),
    ('Análisis de métricas', 3, 3);

-- Preguntas frecuentes de ejemplo
INSERT INTO preguntas_frecuentes (pregunta, respuesta) VALUES
    (
        '¿Cómo puedo solicitar un servicio?',
        'Puedes solicitar un servicio seleccionando el paquete que mejor se adapte a tus necesidades, eligiendo un miembro del equipo y completando el formulario de solicitud.'
    ),
    (
        '¿Cuáles son los métodos de pago?',
        'Aceptamos transferencias bancarias, tarjetas de crédito/débito y PayPal. El pago se realiza una vez aprobada la propuesta.'
    ),
    (
        '¿Cuánto tiempo toma completar un proyecto?',
        'El tiempo varía según la complejidad del proyecto. En la consulta inicial te proporcionaremos un estimado detallado.'
    );

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
SELECT 'Base de datos configurada correctamente' as resultado;
