-- =====================================================
-- SCRIPT DE MIGRACIÓN A SNAKE_CASE
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =====================================================
-- IMPORTANTE: Este script hace backup de los datos, elimina las tablas
-- antiguas y crea nuevas con la convención snake_case.
-- =====================================================

-- =====================================================
-- PASO 1: CREAR TABLAS TEMPORALES CON LOS DATOS ACTUALES
-- =====================================================

-- Backup de Fuentes
CREATE TABLE IF NOT EXISTS _backup_fuentes AS SELECT * FROM "Fuentes";

-- Backup de Miembros
CREATE TABLE IF NOT EXISTS _backup_miembros AS SELECT * FROM "Miembros";

-- Backup de Paquetes
CREATE TABLE IF NOT EXISTS _backup_paquetes AS SELECT * FROM "Paquetes";

-- Backup de Clientes
CREATE TABLE IF NOT EXISTS _backup_clientes AS SELECT * FROM "Clientes";

-- Backup de Acciones
CREATE TABLE IF NOT EXISTS _backup_acciones AS SELECT * FROM "Acciones";

-- Backup de Tickets
CREATE TABLE IF NOT EXISTS _backup_tickets AS SELECT * FROM "Tickets";

-- Backup de Aspirantes
CREATE TABLE IF NOT EXISTS _backup_aspirantes AS SELECT * FROM "Aspirantes";

-- Backup de PreguntasFrecuentes
CREATE TABLE IF NOT EXISTS _backup_preguntas_frecuentes AS SELECT * FROM "PreguntasFrecuentes";

-- Backup de TicketsPaquetes
CREATE TABLE IF NOT EXISTS _backup_tickets_paquetes AS SELECT * FROM "TicketsPaquetes";

-- Backup de Productos
CREATE TABLE IF NOT EXISTS _backup_productos AS SELECT * FROM "Productos";

-- =====================================================
-- PASO 2: ELIMINAR TABLAS ANTIGUAS (en orden por dependencias)
-- =====================================================

DROP TABLE IF EXISTS "TicketsPaquetes" CASCADE;
DROP TABLE IF EXISTS "Tickets" CASCADE;
DROP TABLE IF EXISTS "Productos" CASCADE;
DROP TABLE IF EXISTS "Clientes" CASCADE;
DROP TABLE IF EXISTS "Acciones" CASCADE;
DROP TABLE IF EXISTS "Miembros" CASCADE;
DROP TABLE IF EXISTS "Paquetes" CASCADE;
DROP TABLE IF EXISTS "Fuentes" CASCADE;
DROP TABLE IF EXISTS "Aspirantes" CASCADE;
DROP TABLE IF EXISTS "PreguntasFrecuentes" CASCADE;

-- =====================================================
-- PASO 3: CREAR NUEVAS TABLAS CON SNAKE_CASE
-- =====================================================

-- Tabla: fuentes
CREATE TABLE fuentes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255)
);
COMMENT ON TABLE fuentes IS 'Lista de fuentes/categorías para acciones y puestos';

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
COMMENT ON TABLE paquetes IS 'Lista de paquetes de servicios ofrecidos';

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
    celular VARCHAR(50),
    cv_profile UUID REFERENCES cv_profile(id)
);
COMMENT ON TABLE miembros IS 'Listado de miembros del grupo';
COMMENT ON COLUMN miembros.costo IS 'Costo por hora base';

-- Tabla: acciones
CREATE TABLE acciones (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(255),
    id_miembro BIGINT REFERENCES miembros(id),
    id_fuente BIGINT REFERENCES fuentes(id)
);
COMMENT ON TABLE acciones IS 'Lista de acciones/servicios para cada miembro';

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
COMMENT ON TABLE clientes IS 'Listado de clientes del Grupo Corazones Cruzados';

-- Tabla: tickets
CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_cliente BIGINT REFERENCES clientes(id),
    id_accion BIGINT REFERENCES acciones(id),
    detalle VARCHAR(1000),
    estado VARCHAR(50),
    fecha_fin DATE,
    consumo BIGINT
);
COMMENT ON TABLE tickets IS 'Listado de tickets generados por clientes';

-- Tabla: tickets_paquetes
CREATE TABLE tickets_paquetes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    id_paquete BIGINT REFERENCES paquetes(id),
    id_miembro BIGINT REFERENCES miembros(id),
    id_cliente BIGINT REFERENCES clientes(id)
);
COMMENT ON TABLE tickets_paquetes IS 'Lista de paquetes solicitados por clientes';

-- Tabla: aspirantes
CREATE TABLE aspirantes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    motivo VARCHAR(1000)
);
COMMENT ON TABLE aspirantes IS 'Lista de aspirantes a unirse al grupo';

-- Tabla: preguntas_frecuentes
CREATE TABLE preguntas_frecuentes (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    pregunta VARCHAR(500),
    respuesta VARCHAR(2000),
    video_url TEXT
);
COMMENT ON TABLE preguntas_frecuentes IS 'Lista de preguntas frecuentes';

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
COMMENT ON TABLE productos IS 'Productos/servicios ofrecidos por miembros';

-- =====================================================
-- PASO 4: MIGRAR DATOS DESDE BACKUPS
-- =====================================================

-- Migrar fuentes
INSERT INTO fuentes (id, created_at, nombre)
SELECT id, created_at, "Fuente"
FROM _backup_fuentes;

-- Migrar paquetes
INSERT INTO paquetes (id, created_at, nombre, contenido, horas, descripcion, descuento)
SELECT id, created_at, "Nombre", "Contenido", "Horas", "Descripcion", "Descuento"
FROM _backup_paquetes;

-- Migrar miembros
INSERT INTO miembros (id, created_at, nombre, puesto, descripcion, foto, costo, correo, id_fuente, cod_usuario, celular, cv_profile)
SELECT id, created_at, "Nombre", "Puesto", "Descripcion", "Foto", "Costo", "Correo", "idFuentes", "codUsuario", celular, cv_profile
FROM _backup_miembros;

-- Migrar acciones
INSERT INTO acciones (id, created_at, nombre, id_miembro, id_fuente)
SELECT id, created_at, "Accion", "idMiembro", "idFuente"
FROM _backup_acciones;

-- Migrar clientes
INSERT INTO clientes (id, created_at, nombre, contacto, correo_electronico, id_miembro, id_accion)
SELECT id, created_at, "Nombre", "Contacto", "CorreoElectronico", "idMiembro", "idAccion"
FROM _backup_clientes;

-- Migrar tickets
INSERT INTO tickets (id, created_at, id_cliente, id_accion, detalle, estado, fecha_fin, consumo)
SELECT id, created_at, "idCliente", "idAccion", "Detalle", "Estado", "FechaFin", "Consumo"
FROM _backup_tickets;

-- Migrar tickets_paquetes
INSERT INTO tickets_paquetes (id, created_at, id_paquete, id_miembro, id_cliente)
SELECT id, created_at, "idPaquete", "idMiembro", "idCliente"
FROM _backup_tickets_paquetes;

-- Migrar aspirantes
INSERT INTO aspirantes (id, created_at, motivo)
SELECT id, created_at, "Motivo"
FROM _backup_aspirantes;

-- Migrar preguntas_frecuentes
INSERT INTO preguntas_frecuentes (id, created_at, pregunta, respuesta, video_url)
SELECT id, created_at, "Pregunta", "Respuesta", "videoUrl"
FROM _backup_preguntas_frecuentes;

-- Migrar productos
INSERT INTO productos (id, created_at, nombre, herramientas, descripcion, costo, imagen, id_miembro, link_detalles)
SELECT id, created_at, nombre, herramientas, descripcion, costo, imagen, idmiembro, "linkDetalles"
FROM _backup_productos;

-- =====================================================
-- PASO 5: ACTUALIZAR SECUENCIAS (para que los IDs continúen correctamente)
-- =====================================================

SELECT setval('fuentes_id_seq', COALESCE((SELECT MAX(id) FROM fuentes), 1));
SELECT setval('paquetes_id_seq', COALESCE((SELECT MAX(id) FROM paquetes), 1));
SELECT setval('miembros_id_seq', COALESCE((SELECT MAX(id) FROM miembros), 1));
SELECT setval('acciones_id_seq', COALESCE((SELECT MAX(id) FROM acciones), 1));
SELECT setval('clientes_id_seq', COALESCE((SELECT MAX(id) FROM clientes), 1));
SELECT setval('tickets_id_seq', COALESCE((SELECT MAX(id) FROM tickets), 1));
SELECT setval('tickets_paquetes_id_seq', COALESCE((SELECT MAX(id) FROM tickets_paquetes), 1));
SELECT setval('aspirantes_id_seq', COALESCE((SELECT MAX(id) FROM aspirantes), 1));
SELECT setval('preguntas_frecuentes_id_seq', COALESCE((SELECT MAX(id) FROM preguntas_frecuentes), 1));
SELECT setval('productos_id_seq', COALESCE((SELECT MAX(id) FROM productos), 1));

-- =====================================================
-- PASO 6: HABILITAR RLS Y POLÍTICAS PÚBLICAS (opcional)
-- =====================================================

-- Habilitar acceso público para lectura (ajusta según tus necesidades)
ALTER TABLE fuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE paquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE acciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_paquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspirantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE preguntas_frecuentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso público (SELECT para todos)
CREATE POLICY "Acceso público lectura fuentes" ON fuentes FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura paquetes" ON paquetes FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura miembros" ON miembros FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura acciones" ON acciones FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura preguntas_frecuentes" ON preguntas_frecuentes FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura productos" ON productos FOR SELECT USING (true);

-- Políticas de INSERT público (para formularios)
CREATE POLICY "Acceso público insertar clientes" ON clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Acceso público insertar tickets" ON tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Acceso público insertar tickets_paquetes" ON tickets_paquetes FOR INSERT WITH CHECK (true);
CREATE POLICY "Acceso público insertar aspirantes" ON aspirantes FOR INSERT WITH CHECK (true);

-- Políticas de SELECT para clientes (necesario para verificar existencia)
CREATE POLICY "Acceso público lectura clientes" ON clientes FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura tickets" ON tickets FOR SELECT USING (true);
CREATE POLICY "Acceso público lectura tickets_paquetes" ON tickets_paquetes FOR SELECT USING (true);

-- =====================================================
-- PASO 7: LIMPIAR TABLAS DE BACKUP (ejecutar después de verificar)
-- =====================================================

-- IMPORTANTE: Ejecuta esto SOLO después de verificar que todo funciona correctamente
-- DROP TABLE IF EXISTS _backup_fuentes;
-- DROP TABLE IF EXISTS _backup_miembros;
-- DROP TABLE IF EXISTS _backup_paquetes;
-- DROP TABLE IF EXISTS _backup_clientes;
-- DROP TABLE IF EXISTS _backup_acciones;
-- DROP TABLE IF EXISTS _backup_tickets;
-- DROP TABLE IF EXISTS _backup_aspirantes;
-- DROP TABLE IF EXISTS _backup_preguntas_frecuentes;
-- DROP TABLE IF EXISTS _backup_tickets_paquetes;
-- DROP TABLE IF EXISTS _backup_productos;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
