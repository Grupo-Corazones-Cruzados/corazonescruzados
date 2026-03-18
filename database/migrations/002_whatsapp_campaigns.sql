-- Migration: Create whatsapp_campaigns and whatsapp_sends tables
-- Run: psql $DATABASE_URL -f database/migrations/002_whatsapp_campaigns.sql

CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  message_type     VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'template')),
  message          TEXT NOT NULL DEFAULT '',
  template_name    VARCHAR(200),
  template_lang    VARCHAR(10) DEFAULT 'es',
  template_vars    JSONB DEFAULT '[]',
  list_id          INT REFERENCES email_lists(id) ON DELETE SET NULL,
  category_filter  VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  total_recipients INT NOT NULL DEFAULT 0,
  total_sent       INT NOT NULL DEFAULT 0,
  total_failed     INT NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wcamp_status ON whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_wcamp_created_by ON whatsapp_campaigns(created_by);

CREATE TABLE IF NOT EXISTS whatsapp_sends (
  id              SERIAL PRIMARY KEY,
  campaign_id     INT NOT NULL REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
  contact_id      INT NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed', 'delivered', 'read')),
  provider_id     VARCHAR(100),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ws_campaign ON whatsapp_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ws_contact ON whatsapp_sends(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_campaign_contact ON whatsapp_sends(campaign_id, contact_id);

DROP TRIGGER IF EXISTS trg_whatsapp_campaigns_updated ON whatsapp_campaigns;
CREATE TRIGGER trg_whatsapp_campaigns_updated BEFORE UPDATE ON whatsapp_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
