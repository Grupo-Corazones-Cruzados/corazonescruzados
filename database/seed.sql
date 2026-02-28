-- =====================================================
-- SEED DATA — Corazones Cruzados v2
-- =====================================================

-- Dashboard modules
INSERT INTO modules (name, description, icon, path, sort_order, requires_verification, allowed_roles) VALUES
  ('Tickets',     'Create and manage support tickets. Book appointments with team members.', 'ticket',   '/dashboard/tickets',     1, true, ARRAY['client','member','admin']),
  ('Projects',    'Publish projects and receive proposals from qualified members.',          'folder',   '/dashboard/projects',    2, true, ARRAY['client','member','admin']),
  ('Packages',    'Purchase service packages and track usage.',                               'package',  '/dashboard/packages',    3, true, ARRAY['client','member','admin']),
  ('Invoices',    'View invoice history, pending payments, and download receipts.',           'receipt',  '/dashboard/invoices',    4, true, ARRAY['client','member','admin']),
  ('Marketplace', 'Browse and purchase products.',                                            'store',    '/dashboard/marketplace', 5, true, ARRAY['client','member','admin']),
  ('Recruitment', 'Manage applicants, events, and evaluations.',                              'users',    '/dashboard/recruitment', 6, true, ARRAY['member','admin']),
  ('Settings',    'Manage your profile, availability, and external connections.',             'settings', '/dashboard/settings',    7, true, ARRAY['client','member','admin']),
  ('Admin',       'System administration panel.',                                             'shield',   '/dashboard/admin',       8, true, ARRAY['admin'])
ON CONFLICT DO NOTHING;

-- Default departments
INSERT INTO departments (name, description) VALUES
  ('Engineering',  'Software development and technical services'),
  ('Design',       'UI/UX design and branding'),
  ('Marketing',    'Digital marketing and content creation'),
  ('Consulting',   'Business and strategy consulting'),
  ('Support',      'Client support and assistance')
ON CONFLICT DO NOTHING;
