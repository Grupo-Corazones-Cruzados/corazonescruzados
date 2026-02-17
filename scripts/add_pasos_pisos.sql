-- Migración: Agregar tablas pasos, pisos y columnas en miembros

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

-- Agregar columnas a miembros
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS id_paso BIGINT REFERENCES pasos(id);
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS id_piso BIGINT REFERENCES pisos(id);
