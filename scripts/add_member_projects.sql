-- Migration: Add support for member-owned projects
-- This allows members to create their own projects with private or public visibility

-- Make id_cliente optional (allow NULL)
ALTER TABLE projects ALTER COLUMN id_cliente DROP NOT NULL;

-- Add owner member column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS id_miembro_propietario BIGINT REFERENCES miembros(id) ON DELETE SET NULL;

-- Add visibility column (private by default)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visibilidad VARCHAR(20) DEFAULT 'privado';

-- Add constraint for visibility values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_visibilidad_check'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_visibilidad_check
      CHECK (visibilidad IN ('privado', 'publico'));
  END IF;
END$$;

-- Add project type column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tipo_proyecto VARCHAR(20) DEFAULT 'cliente';

-- Add constraint for project type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'projects_tipo_proyecto_check'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT projects_tipo_proyecto_check
      CHECK (tipo_proyecto IN ('cliente', 'miembro'));
  END IF;
END$$;

-- Create index for member owner queries
CREATE INDEX IF NOT EXISTS idx_projects_miembro_propietario ON projects(id_miembro_propietario);

-- Create index for visibility queries
CREATE INDEX IF NOT EXISTS idx_projects_visibilidad ON projects(visibilidad);

-- Create index for project type queries
CREATE INDEX IF NOT EXISTS idx_projects_tipo_proyecto ON projects(tipo_proyecto);

-- Constraint: must have either client or member owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_owner_exists'
  ) THEN
    ALTER TABLE projects ADD CONSTRAINT check_owner_exists
      CHECK (id_cliente IS NOT NULL OR id_miembro_propietario IS NOT NULL);
  END IF;
END$$;

-- Migrate existing projects: set tipo_proyecto to 'cliente' where NULL
UPDATE projects SET tipo_proyecto = 'cliente' WHERE tipo_proyecto IS NULL;

-- Migrate existing projects: set visibilidad to 'publico' for existing client projects
UPDATE projects SET visibilidad = 'publico' WHERE visibilidad IS NULL AND id_cliente IS NOT NULL;
