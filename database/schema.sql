-- =====================================================
-- CORAZONES CRUZADOS v2 — COMPLETE DATABASE SCHEMA
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
-- PHASE 1: AUTH & USERS
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
  reset_token       TEXT,
  reset_token_exp   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_member ON users(member_id);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vt_token ON verification_tokens(token);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45) NOT NULL,
  reason     TEXT,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS google_tokens (
  id            UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date   BIGINT,
  scope         TEXT
);

-- =====================================================
-- PHASE 2: CORE ENTITIES
-- =====================================================

CREATE TABLE IF NOT EXISTS departments (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       VARCHAR(255) NOT NULL,
  description TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS members (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE,
  phone      VARCHAR(50),
  photo_url  TEXT,
  position   VARCHAR(255),
  hourly_rate DECIMAL(10,2),
  department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE users
  ADD CONSTRAINT fk_users_member FOREIGN KEY (member_id)
  REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_active ON members(is_active);

CREATE TABLE IF NOT EXISTS clients (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE NOT NULL,
  phone      VARCHAR(50),
  company    VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

CREATE TABLE IF NOT EXISTS services (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  base_price  DECIMAL(10,2),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

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
-- PHASE 3: MEMBER SCHEDULES
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
-- PHASE 4: TICKETS
-- =====================================================

CREATE TABLE IF NOT EXISTS tickets (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_id       BIGINT REFERENCES clients(id) ON DELETE CASCADE,
  service_id      BIGINT REFERENCES services(id) ON DELETE SET NULL,
  member_id       BIGINT REFERENCES members(id) ON DELETE SET NULL,
  title           VARCHAR(255),
  description     TEXT,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled')),
  scheduled_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  estimated_hours DECIMAL(10,2),
  actual_hours    DECIMAL(10,2),
  estimated_cost  DECIMAL(10,2),
  actual_cost     DECIMAL(10,2),
  google_event_id VARCHAR(255),
  google_meet_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_member ON tickets(member_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

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
-- PHASE 5: PROJECTS
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
                     CHECK (status IN (
                       'draft','published','planned','started',
                       'in_progress','in_development','in_testing',
                       'completed','partially_completed','not_completed',
                       'cancelled','cancelled_no_agreement','cancelled_no_budget',
                       'unpaid','not_completed_by_member'
                     )),
  is_private         BOOLEAN NOT NULL DEFAULT FALSE,
  share_token        VARCHAR(64) UNIQUE,
  CONSTRAINT valid_budget CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_member ON projects(assigned_member_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_token ON projects(share_token);

CREATE TABLE IF NOT EXISTS project_bids (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id       BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  proposal        TEXT NOT NULL,
  bid_amount      DECIMAL(10,2) NOT NULL,
  estimated_days  INT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','rejected')),
  UNIQUE(project_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_project ON project_bids(project_id);
CREATE INDEX IF NOT EXISTS idx_pb_member ON project_bids(member_id);

CREATE TABLE IF NOT EXISTS project_requirements (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id    BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  cost          DECIMAL(10,2),
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pr_project ON project_requirements(project_id);

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

-- =====================================================
-- PHASE 6: PACKAGES
-- =====================================================

CREATE TABLE IF NOT EXISTS packages (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  hours       DECIMAL(10,2) NOT NULL,
  features    TEXT[],
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS package_purchases (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  package_id   BIGINT NOT NULL REFERENCES packages(id),
  client_id    BIGINT NOT NULL REFERENCES clients(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  hours_total  DECIMAL(10,2) NOT NULL,
  hours_used   DECIMAL(10,2) NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','exhausted','expired','cancelled')),
  expires_at   TIMESTAMPTZ,
  payment_ref  VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_pp_client ON package_purchases(client_id);

CREATE TABLE IF NOT EXISTS package_requests (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purchase_id    BIGINT NOT NULL REFERENCES package_purchases(id) ON DELETE CASCADE,
  client_id      BIGINT NOT NULL REFERENCES clients(id),
  service_id     BIGINT REFERENCES services(id),
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  hours_requested DECIMAL(10,2),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','in_progress','completed','rejected')),
  resolved_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS package_assignments (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id  BIGINT NOT NULL REFERENCES package_requests(id) ON DELETE CASCADE,
  member_id   BIGINT NOT NULL REFERENCES members(id),
  hours_assigned DECIMAL(10,2) NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'assigned'
              CHECK (status IN ('assigned','in_progress','completed'))
);

CREATE TABLE IF NOT EXISTS package_progress_updates (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assignment_id BIGINT NOT NULL REFERENCES package_assignments(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id),
  content       TEXT NOT NULL,
  hours_logged  DECIMAL(10,2)
);

-- =====================================================
-- PHASE 7: INVOICES
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
-- PHASE 8: MARKETPLACE
-- =====================================================

CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  price       DECIMAL(10,2) NOT NULL,
  image_url   TEXT,
  category    VARCHAR(100),
  stock       INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cart_items (
  id         BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity   INT NOT NULL DEFAULT 1,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id             BIGSERIAL PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id        UUID NOT NULL REFERENCES users(id),
  total          DECIMAL(10,2) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  paypal_order_id VARCHAR(255),
  paypal_capture_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal   DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- =====================================================
-- PHASE 9: RECRUITMENT
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
CREATE INDEX IF NOT EXISTS idx_app_email ON applicants(email);

CREATE TABLE IF NOT EXISTS recruitment_events (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  event_date   TIMESTAMPTZ NOT NULL,
  location     VARCHAR(255),
  type         VARCHAR(50) NOT NULL CHECK (type IN ('interview','evaluation','orientation','training')),
  max_capacity INT,
  created_by   UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS event_invitations (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_id     BIGINT NOT NULL REFERENCES recruitment_events(id) ON DELETE CASCADE,
  applicant_id BIGINT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','attended','no_show')),
  UNIQUE(event_id, applicant_id)
);

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

CREATE TABLE IF NOT EXISTS applicant_restrictions (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applicant_id BIGINT NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  restriction  TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================
-- PHASE 10: CV & PORTFOLIO
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
  member_id   BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  image_url   TEXT,
  project_url TEXT,
  tags        TEXT[],
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_mpi_member ON member_portfolio_items(member_id);

-- =====================================================
-- FAQ
-- =====================================================

CREATE TABLE IF NOT EXISTS faq (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    VARCHAR(100),
  sort_order  INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE
);

-- =====================================================
-- TRIGGERS
-- =====================================================

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

DROP TRIGGER IF EXISTS trg_tickets_updated ON tickets;
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated ON invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_applicants_updated ON applicants;
CREATE TRIGGER trg_applicants_updated BEFORE UPDATE ON applicants FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_google_tokens_updated ON google_tokens;
CREATE TRIGGER trg_google_tokens_updated BEFORE UPDATE ON google_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_cv_profiles_updated ON member_cv_profiles;
CREATE TRIGGER trg_cv_profiles_updated BEFORE UPDATE ON member_cv_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
