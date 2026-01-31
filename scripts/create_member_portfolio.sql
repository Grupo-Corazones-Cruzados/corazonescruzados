-- Create member_portfolio table
-- This table stores portfolio entries automatically created when projects are completed

CREATE TABLE IF NOT EXISTS member_portfolio (
  id BIGSERIAL PRIMARY KEY,
  id_miembro BIGINT NOT NULL REFERENCES miembros(id) ON DELETE CASCADE,
  id_project BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Denormalized project info for display
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,

  -- The functions/requirements this member completed in the project
  -- Stored as JSON array: [{ titulo, descripcion, costo }]
  funciones JSONB DEFAULT '[]'::jsonb,

  -- Total earned from this project (monto_acordado from bid)
  monto_ganado DECIMAL(10, 2),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fecha_proyecto_completado TIMESTAMPTZ,

  -- Prevent duplicate entries
  UNIQUE(id_miembro, id_project)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_member_portfolio_miembro ON member_portfolio(id_miembro);
CREATE INDEX IF NOT EXISTS idx_member_portfolio_project ON member_portfolio(id_project);
CREATE INDEX IF NOT EXISTS idx_member_portfolio_created ON member_portfolio(created_at DESC);

-- Comment on table
COMMENT ON TABLE member_portfolio IS 'Stores portfolio entries for members, auto-created when projects are completed';
COMMENT ON COLUMN member_portfolio.funciones IS 'JSON array of requirements completed by this member: [{titulo, descripcion, costo}]';
