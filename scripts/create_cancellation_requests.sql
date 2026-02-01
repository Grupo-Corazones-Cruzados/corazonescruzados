-- Create table for project cancellation requests
-- When a project is in active states, cancellation requires all participants to confirm

CREATE TABLE IF NOT EXISTS project_cancellation_requests (
  id BIGSERIAL PRIMARY KEY,
  id_project BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  creado_por_id BIGINT NOT NULL,
  creado_por_tipo VARCHAR(20) NOT NULL CHECK (creado_por_tipo IN ('miembro', 'cliente')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'expirada')),
  finalizado_at TIMESTAMPTZ,
  UNIQUE(id_project, estado) -- Only one active request per project
);

-- Create table for cancellation votes from each participant
CREATE TABLE IF NOT EXISTS project_cancellation_votes (
  id BIGSERIAL PRIMARY KEY,
  id_cancellation_request BIGINT NOT NULL REFERENCES project_cancellation_requests(id) ON DELETE CASCADE,
  id_participante BIGINT NOT NULL,
  tipo_participante VARCHAR(20) NOT NULL CHECK (tipo_participante IN ('miembro', 'cliente', 'propietario')),
  voto VARCHAR(20) NOT NULL CHECK (voto IN ('confirmar', 'rechazar')),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_cancellation_request, id_participante, tipo_participante)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_project ON project_cancellation_requests(id_project);
CREATE INDEX IF NOT EXISTS idx_cancellation_requests_estado ON project_cancellation_requests(estado) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_cancellation_votes_request ON project_cancellation_votes(id_cancellation_request);
