-- Migration: Extend Projects System
-- Adds support for:
-- 1. External clients (not registered in the system)
-- 2. New intermediate project states
-- 3. Shareable public links
-- 4. Participant removal tracking

-- ============================================
-- 1. NEW COLUMNS FOR EXTERNAL CLIENT
-- ============================================
-- For private projects where the client is not registered in the system
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cliente_externo_email VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cliente_externo_nombre VARCHAR(255);

-- ============================================
-- 2. SHAREABLE PUBLIC LINK TOKEN
-- ============================================
-- Token for generating shareable public links without authentication
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;

-- ============================================
-- 3. UPDATE PROJECT STATE CONSTRAINT
-- ============================================
-- Add new intermediate states: en_implementacion, en_pruebas
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_estado_check;
ALTER TABLE projects ADD CONSTRAINT projects_estado_check CHECK (
  estado IN (
    'borrador',
    'publicado',
    'planificado',
    'iniciado',
    'en_progreso',
    'en_implementacion',
    'en_pruebas',
    'completado',
    'completado_parcial',
    'no_completado',
    'cancelado',
    'cancelado_sin_acuerdo',
    'cancelado_sin_presupuesto',
    'no_pagado',
    'no_completado_por_miembro'
  )
);

-- ============================================
-- 4. PARTICIPANT REMOVAL TRACKING
-- ============================================
-- Columns for tracking removed participants with reason
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS removido BOOLEAN DEFAULT FALSE;
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS fecha_remocion TIMESTAMPTZ;
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS motivo_remocion TEXT;
ALTER TABLE project_bids ADD COLUMN IF NOT EXISTS removido_por_id BIGINT;

-- Foreign key for removal tracking (optional - can be added if strict referential integrity is needed)
-- ALTER TABLE project_bids ADD CONSTRAINT fk_removido_por
--   FOREIGN KEY (removido_por_id) REFERENCES miembros(id) ON DELETE SET NULL;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN projects.cliente_externo_email IS 'Email of external client (not registered in the system)';
COMMENT ON COLUMN projects.cliente_externo_nombre IS 'Name of external client';
COMMENT ON COLUMN projects.share_token IS 'Unique token for public shareable link';
COMMENT ON COLUMN projects.share_token_created_at IS 'When the share token was created';
COMMENT ON COLUMN projects.share_token_expires_at IS 'When the share token expires (null = permanent)';

COMMENT ON COLUMN project_bids.removido IS 'Whether the participant was removed from the project';
COMMENT ON COLUMN project_bids.fecha_remocion IS 'When the participant was removed';
COMMENT ON COLUMN project_bids.motivo_remocion IS 'Reason for removing the participant';
COMMENT ON COLUMN project_bids.removido_por_id IS 'ID of the member who removed the participant';
