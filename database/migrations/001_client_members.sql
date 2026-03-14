-- Create client_members junction table
CREATE TABLE IF NOT EXISTS client_members (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id  BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  source     VARCHAR(50) NOT NULL DEFAULT 'manual',
  UNIQUE(client_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_client ON client_members(client_id);
CREATE INDEX IF NOT EXISTS idx_cm_member ON client_members(member_id);

-- Backfill from existing data

-- From projects with assigned_member_id
INSERT INTO client_members (client_id, member_id, source)
SELECT DISTINCT p.client_id, p.assigned_member_id, 'project_created'
FROM projects p
WHERE p.client_id IS NOT NULL AND p.assigned_member_id IS NOT NULL
ON CONFLICT (client_id, member_id) DO NOTHING;

-- From accepted project bids
INSERT INTO client_members (client_id, member_id, source)
SELECT DISTINCT p.client_id, pb.member_id, 'project_bid'
FROM project_bids pb
JOIN projects p ON p.id = pb.project_id
WHERE pb.status = 'accepted' AND p.client_id IS NOT NULL
ON CONFLICT (client_id, member_id) DO NOTHING;

-- From tickets with both client_id and member_id
INSERT INTO client_members (client_id, member_id, source)
SELECT DISTINCT t.client_id, t.member_id, 'ticket_created'
FROM tickets t
WHERE t.client_id IS NOT NULL AND t.member_id IS NOT NULL
ON CONFLICT (client_id, member_id) DO NOTHING;
