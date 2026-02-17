-- Migración: Agregar tabla sistemas y tabla intermedia miembros_sistemas

-- Tabla: sistemas
CREATE TABLE IF NOT EXISTS sistemas (
    id BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    secuencia INT DEFAULT 0
);

-- Tabla intermedia: miembros_sistemas (muchos a muchos)
CREATE TABLE IF NOT EXISTS miembros_sistemas (
    id BIGSERIAL PRIMARY KEY,
    id_miembro BIGINT NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
    id_sistema BIGINT NOT NULL REFERENCES sistemas(id) ON DELETE CASCADE,
    UNIQUE(id_miembro, id_sistema)
);
