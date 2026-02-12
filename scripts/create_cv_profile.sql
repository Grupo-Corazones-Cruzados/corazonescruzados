-- Create cv_profile table
-- Stores curriculum vitae / resume data for members

CREATE TABLE IF NOT EXISTS cv_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  full_name   VARCHAR(255),
  headline    VARCHAR(255),
  summary     TEXT,
  location    VARCHAR(255),
  phone       VARCHAR(50),
  email       VARCHAR(255),
  website     VARCHAR(500),
  linkedin    VARCHAR(500),
  github      VARCHAR(500),

  -- Structured data (JSONB arrays)
  languages      JSONB DEFAULT '[]'::jsonb,   -- [{ name, level }]
  certifications JSONB DEFAULT '[]'::jsonb,   -- [{ name, level, issuer }]
  skills         JSONB DEFAULT '[]'::jsonb,   -- ["skill1", "skill2", ...]
  experience     JSONB DEFAULT '[]'::jsonb,   -- [{ company, role, start_date, end_date, current, location, summary, bullets }]
  education      JSONB DEFAULT '[]'::jsonb,   -- [{ institution, degree, start_year, end_year, notes }]

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add cv_profile foreign key to miembros (if column doesn't exist yet)
ALTER TABLE miembros ADD COLUMN IF NOT EXISTS cv_profile UUID REFERENCES cv_profile(id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cv_profile_updated ON cv_profile(updated_at DESC NULLS LAST);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_cv_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cv_profile_updated_at ON cv_profile;
CREATE TRIGGER trg_cv_profile_updated_at
  BEFORE UPDATE ON cv_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_cv_profile_updated_at();
