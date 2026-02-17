-- Migración: Agregar tablas pilares, pisos y columnas en miembros

-- Tabla: pilares
CREATE TABLE IF NOT EXISTS pilares (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

-- Tabla: pisos
CREATE TABLE IF NOT EXISTS pisos (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL
);

-- Agregar columnas a miembros
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS id_pilar BIGINT REFERENCES pilares(id);
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS id_piso BIGINT REFERENCES pisos(id);
