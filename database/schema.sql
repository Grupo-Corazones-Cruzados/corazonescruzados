-- =====================================================
-- CORAZONES CRUZADOS v2 — DATABASE SCHEMA (34 tables)
-- All tables: English, plural, snake_case
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  ym TEXT;
  seq INT;
BEGIN
  ym := TO_CHAR(NOW(), 'YYYYMM');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INT)), 0) + 1
  INTO seq
  FROM invoices
  WHERE invoice_number LIKE 'INV' || ym || '%';
  RETURN 'INV' || ym || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 1. USERS & AUTH
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name    VARCHAR(255),
  last_name     VARCHAR(255),
  avatar_url    TEXT,
  phone         VARCHAR(50),
  role          VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'member', 'admin')),
  member_id     BIGINT,  -- FK added after members table
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token            TEXT,
  reset_token_exp        TIMESTAMPTZ,
  tokens_invalidated_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_member ON users(member_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vt_user ON verification_tokens(user_id);

-- =====================================================
-- 2. MEMBERS
-- =====================================================

CREATE TABLE IF NOT EXISTS members (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE,
  phone      VARCHAR(50),
  photo_url  TEXT,
  position_id BIGINT REFERENCES positions(id) ON DELETE SET NULL,
  hourly_rate DECIMAL(10,2),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  is_blocked_from_projects BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_member FOREIGN KEY (member_id)
  REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active);

-- =====================================================
-- 3. CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS clients (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  phone      VARCHAR(50),
  company    VARCHAR(255)
);

-- =====================================================
-- 3b. CLIENT ↔ MEMBER ASSOCIATIONS
-- =====================================================

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

-- =====================================================
-- 4. POSITIONS & SERVICES
-- =====================================================

CREATE TABLE IF NOT EXISTS positions (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_positions_active ON positions(is_active);

CREATE TABLE IF NOT EXISTS services (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  position_id BIGINT REFERENCES positions(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  base_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
CREATE INDEX IF NOT EXISTS idx_services_position ON services(position_id);

-- Member ↔ Service many-to-many
CREATE TABLE IF NOT EXISTS member_services (
  id         BIGSERIAL PRIMARY KEY,
  member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_member_services_member ON member_services(member_id);
CREATE INDEX IF NOT EXISTS idx_member_services_service ON member_services(service_id);

-- =====================================================
-- 5. MODULES
-- =====================================================

CREATE TABLE IF NOT EXISTS modules (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  icon        VARCHAR(100),
  path        VARCHAR(255),
  sort_order  INT NOT NULL DEFAULT 0,
  requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_roles TEXT[] DEFAULT ARRAY['client', 'member', 'admin']
);

-- =====================================================
-- 6. MEMBER SCHEDULES
-- =====================================================

CREATE TABLE IF NOT EXISTS member_schedules (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT valid_schedule_hours CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_ms_member ON member_schedules(member_id);

CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  type       VARCHAR(20) NOT NULL CHECK (type IN ('blocked', 'available')),
  reason     VARCHAR(255),
  start_time TIME,
  end_time   TIME
);

CREATE INDEX IF NOT EXISTS idx_se_member ON schedule_exceptions(member_id);
CREATE INDEX IF NOT EXISTS idx_se_date ON schedule_exceptions(date);

-- =====================================================
-- 7. TICKETS
-- =====================================================

CREATE TABLE IF NOT EXISTS tickets (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  service_id      BIGINT REFERENCES services(id) ON DELETE SET NULL,
  member_id       BIGINT REFERENCES members(id) ON DELETE SET NULL,
  client_id       BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','withdrawn')),
  deadline        DATE,
  completed_at    TIMESTAMPTZ,
  cancellation_reason TEXT,
  estimated_hours DECIMAL(10,2),
  actual_hours    DECIMAL(10,2),
  estimated_cost  DECIMAL(10,2),
  actual_cost     DECIMAL(10,2),
  google_event_id VARCHAR(255),
  google_meet_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_member ON tickets(member_id);
CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_deadline ON tickets(deadline) WHERE deadline IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_time_slots (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_id   BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','confirmed','completed','cancelled')),
  actual_duration DECIMAL(10,2),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_tts_ticket ON ticket_time_slots(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tts_date ON ticket_time_slots(date);

CREATE TABLE IF NOT EXISTS ticket_services (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticket_id      BIGINT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  service_id     BIGINT REFERENCES services(id) ON DELETE SET NULL,
  assigned_hours DECIMAL(10,2) NOT NULL,
  hourly_cost    DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) GENERATED ALWAYS AS (assigned_hours * hourly_cost) STORED
);

CREATE INDEX IF NOT EXISTS idx_ts_ticket ON ticket_services(ticket_id);

-- =====================================================
-- 8. PROJECTS
-- =====================================================

CREATE TABLE IF NOT EXISTS projects (
  id                 BIGSERIAL PRIMARY KEY,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id          BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  assigned_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
  title              VARCHAR(255) NOT NULL,
  description        TEXT,
  budget_min         DECIMAL(10,2),
  budget_max         DECIMAL(10,2),
  deadline           DATE,
  status             VARCHAR(30) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','open','in_progress','review','completed','cancelled','on_hold','closed')),
  is_private         BOOLEAN NOT NULL DEFAULT FALSE,
  share_token        VARCHAR(64) UNIQUE,
  cancellation_reason TEXT,
  final_cost         DECIMAL(10,2),
  confirmed_at       TIMESTAMPTZ,
  completion_notified_at TIMESTAMPTZ,
  review_deadline    DATE,
  penalty_applied    BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT valid_budget CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_member ON projects(assigned_member_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS project_bids (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  proposal        TEXT,
  bid_amount      DECIMAL(10,2),
  estimated_days  INT,
  requirement_ids BIGINT[] DEFAULT '{}',
  work_dates      DATE[] DEFAULT '{}',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('invited','pending','accepted','rejected')),
  UNIQUE(project_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_member ON project_bids(member_id);
CREATE INDEX IF NOT EXISTS idx_pb_status ON project_bids(status);

CREATE TABLE IF NOT EXISTS project_requirements (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id    BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  cost          DECIMAL(10,2),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pr_project ON project_requirements(project_id);

CREATE TABLE IF NOT EXISTS requirement_items (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requirement_id  BIGINT NOT NULL REFERENCES project_requirements(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,
  sort_order      INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ri_requirement ON requirement_items(requirement_id);

CREATE TABLE IF NOT EXISTS requirement_assignments (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requirement_id  BIGINT NOT NULL REFERENCES project_requirements(id) ON DELETE CASCADE,
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  proposed_cost   DECIMAL(10,2) NOT NULL,
  member_cost     DECIMAL(10,2),
  status          VARCHAR(20) NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','counter','accepted','rejected')),
  UNIQUE(requirement_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_ra_requirement ON requirement_assignments(requirement_id);
CREATE INDEX IF NOT EXISTS idx_ra_project ON requirement_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_ra_member ON requirement_assignments(member_id);

CREATE TABLE IF NOT EXISTS project_cancellation_requests (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id    BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by  UUID NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  resolved_at   TIMESTAMPTZ,
  resolved_by   UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pcr_project ON project_cancellation_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_pcr_status ON project_cancellation_requests(status);

CREATE TABLE IF NOT EXISTS project_cancellation_votes (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id  BIGINT NOT NULL REFERENCES project_cancellation_requests(id) ON DELETE CASCADE,
  member_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  vote        VARCHAR(10) NOT NULL CHECK (vote IN ('approve', 'reject')),
  comment     TEXT,
  UNIQUE(request_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_pcv_request ON project_cancellation_votes(request_id);
CREATE INDEX IF NOT EXISTS idx_pcv_member ON project_cancellation_votes(member_id);

CREATE TABLE IF NOT EXISTS project_payments (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id    BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amount        DECIMAL(10,2) NOT NULL,
  proof_url     TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','rejected')),
  confirmed_by  UUID REFERENCES users(id),
  confirmed_at  TIMESTAMPTZ,
  notes         TEXT
);

CREATE INDEX IF NOT EXISTS idx_pp_project ON project_payments(project_id);

-- =====================================================
-- 9. INVOICES
-- =====================================================

CREATE TABLE IF NOT EXISTS invoices (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invoice_number  VARCHAR(50) UNIQUE,
  client_id       BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  member_id       BIGINT REFERENCES members(id) ON DELETE SET NULL,
  ticket_id       BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
  project_id      BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax             DECIMAL(10,2) NOT NULL DEFAULT 0,
  total           DECIMAL(10,2) GENERATED ALWAYS AS (subtotal + tax) STORED,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','paid','cancelled')),
  pdf_url         TEXT,
  notes           TEXT,
  sent_at         TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_inv_member ON invoices(member_id);
CREATE INDEX IF NOT EXISTS idx_inv_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_inv_ticket ON invoices(ticket_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invoice_id   BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description  VARCHAR(500) NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price   DECIMAL(10,2) NOT NULL,
  subtotal     DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_ii_invoice ON invoice_items(invoice_id);

-- =====================================================
-- 11. MARKETPLACE
-- =====================================================

CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  image_url   TEXT,
  category    VARCHAR(100),
  stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  allow_quantities BOOLEAN NOT NULL DEFAULT TRUE,
  portfolio_item_id BIGINT UNIQUE REFERENCES member_portfolio_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE TABLE IF NOT EXISTS cart_items (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id        UUID NOT NULL REFERENCES users(id),
  total          DECIMAL(10,2) NOT NULL,
  status         VARCHAR(30) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','pending_confirmation','awaiting_acceptance','awaiting_payment','paid','shipped','delivered','cancelled')),
  paypal_order_id VARCHAR(255),
  paypal_capture_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id                   BIGSERIAL PRIMARY KEY,
  order_id             BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id           BIGINT NOT NULL REFERENCES products(id),
  quantity             INT NOT NULL CHECK (quantity > 0),
  unit_price           DECIMAL(10,2) NOT NULL,
  subtotal             DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  member_id            BIGINT REFERENCES members(id),
  requires_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
  member_confirmed     BOOLEAN,
  member_message       TEXT,
  delivery_date        DATE,
  member_responded_at  TIMESTAMPTZ,
  client_accepted      BOOLEAN,
  client_responded_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_oi_member ON order_items(member_id);

-- =====================================================
-- 12. RECRUITMENT
-- =====================================================

CREATE TABLE IF NOT EXISTS applicants (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_name   VARCHAR(255) NOT NULL,
  last_name    VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  phone        VARCHAR(50),
  resume_url   TEXT,
  status       VARCHAR(30) NOT NULL DEFAULT 'applied'
               CHECK (status IN ('applied','screening','interview','evaluation','accepted','rejected','withdrawn')),
  notes        TEXT,
  source       VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_app_status ON applicants(status);

CREATE TABLE IF NOT EXISTS recruitment_events (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  event_date   TIMESTAMPTZ NOT NULL,
  location     VARCHAR(255),
  type         VARCHAR(50) NOT NULL CHECK (type IN ('interview','evaluation','orientation','training')),
  max_capacity INT,
  created_by   UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_re_date ON recruitment_events(event_date);
CREATE INDEX IF NOT EXISTS idx_re_type ON recruitment_events(type);

CREATE TABLE IF NOT EXISTS event_invitations (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id     BIGINT NOT NULL REFERENCES recruitment_events(id) ON DELETE CASCADE,
  applicant_id BIGINT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','attended','no_show')),
  UNIQUE(event_id, applicant_id)
);

CREATE INDEX IF NOT EXISTS idx_ei_applicant ON event_invitations(applicant_id);

CREATE TABLE IF NOT EXISTS event_scores (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id     BIGINT NOT NULL REFERENCES recruitment_events(id) ON DELETE CASCADE,
  applicant_id BIGINT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES users(id),
  score        DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  comments     TEXT,
  UNIQUE(event_id, applicant_id, evaluator_id)
);

CREATE INDEX IF NOT EXISTS idx_es_applicant ON event_scores(applicant_id);

-- =====================================================
-- 13. CV & PORTFOLIO
-- =====================================================

CREATE TABLE IF NOT EXISTS member_cv_profiles (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id   BIGINT UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  bio         TEXT,
  skills      TEXT[],
  education   JSONB DEFAULT '[]',
  experience  JSONB DEFAULT '[]',
  languages   TEXT[],
  linkedin_url TEXT,
  website_url  TEXT
);

CREATE TABLE IF NOT EXISTS member_portfolio_items (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  image_url   TEXT,
  project_url TEXT,
  tags        TEXT[],
  cost        NUMERIC(12,2),
  allow_quantities BOOLEAN NOT NULL DEFAULT TRUE,
  item_type   VARCHAR(20) NOT NULL DEFAULT 'project',
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mpi_member ON member_portfolio_items(member_id);

-- =====================================================
-- 14. FAQ
-- =====================================================

CREATE TABLE IF NOT EXISTS faq (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    VARCHAR(100),
  sort_order  INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_faq_category ON faq(category);
CREATE INDEX IF NOT EXISTS idx_faq_published ON faq(is_published);

-- =====================================================
-- 15. NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  link       TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  read_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id) WHERE is_read = false;

-- =====================================================
-- 16. EMAIL AUTOMATION
-- =====================================================

CREATE TABLE IF NOT EXISTS email_lists (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  created_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_el_created_by ON email_lists(created_by);

CREATE TABLE IF NOT EXISTS email_contacts (
  id         SERIAL PRIMARY KEY,
  list_id    INT NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  email      VARCHAR(320) NOT NULL,
  phone      VARCHAR(50),
  category   VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ec_list ON email_contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_ec_category ON email_contacts(list_id, category);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  subject          VARCHAR(500) NOT NULL,
  html_body        TEXT NOT NULL DEFAULT '',
  signature_html   TEXT,
  list_id          INT REFERENCES email_lists(id) ON DELETE SET NULL,
  category_filter  VARCHAR(100),
  status           VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_recipients INT NOT NULL DEFAULT 0,
  total_sent       INT NOT NULL DEFAULT 0,
  total_failed     INT NOT NULL DEFAULT 0,
  created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecamp_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ecamp_created_by ON email_campaigns(created_by);

CREATE TABLE IF NOT EXISTS email_sends (
  id              SERIAL PRIMARY KEY,
  campaign_id     INT NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  contact_id      INT NOT NULL REFERENCES email_contacts(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  provider_id     VARCHAR(100),
  error_message   TEXT,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  clicked_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  bounce_type     VARCHAR(20),
  bounce_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_es_campaign ON email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_es_contact ON email_sends(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_es_campaign_contact ON email_sends(campaign_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_es_provider_id ON email_sends(provider_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Invoice number auto-generation
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_number ON invoices;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_members_updated ON members;
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated ON clients;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated ON services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_tickets_updated ON tickets;
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_project_bids_updated ON project_bids;
CREATE TRIGGER trg_project_bids_updated BEFORE UPDATE ON project_bids FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_project_requirements_updated ON project_requirements;
CREATE TRIGGER trg_project_requirements_updated BEFORE UPDATE ON project_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_applicants_updated ON applicants;
CREATE TRIGGER trg_applicants_updated BEFORE UPDATE ON applicants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_recruitment_events_updated ON recruitment_events;
CREATE TRIGGER trg_recruitment_events_updated BEFORE UPDATE ON recruitment_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_event_invitations_updated ON event_invitations;
CREATE TRIGGER trg_event_invitations_updated BEFORE UPDATE ON event_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_cv_profiles_updated ON member_cv_profiles;
CREATE TRIGGER trg_cv_profiles_updated BEFORE UPDATE ON member_cv_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_items_updated ON member_portfolio_items;
CREATE TRIGGER trg_portfolio_items_updated BEFORE UPDATE ON member_portfolio_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_faq_updated ON faq;
CREATE TRIGGER trg_faq_updated BEFORE UPDATE ON faq FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_email_lists_updated ON email_lists;
CREATE TRIGGER trg_email_lists_updated BEFORE UPDATE ON email_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_email_contacts_updated ON email_contacts;
CREATE TRIGGER trg_email_contacts_updated BEFORE UPDATE ON email_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_email_campaigns_updated ON email_campaigns;
CREATE TRIGGER trg_email_campaigns_updated BEFORE UPDATE ON email_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
