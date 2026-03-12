-- =====================================================
-- SEED DATA — Corazones Cruzados v2
-- =====================================================

-- Dashboard modules
INSERT INTO modules (name, description, icon, path, sort_order, requires_verification, allowed_roles) VALUES
  ('Tickets',     'Create and manage support tickets. Book appointments with team members.', 'ticket',   '/dashboard/tickets',     1, true, ARRAY['client','member','admin']),
  ('Projects',    'Publish projects and receive proposals from qualified members.',          'folder',   '/dashboard/projects',    2, true, ARRAY['client','member','admin']),
  ('Invoices',    'View invoice history, pending payments, and download receipts.',           'receipt',  '/dashboard/invoices',    3, true, ARRAY['client','member','admin']),
  ('Marketplace', 'Browse and purchase products.',                                            'store',    '/dashboard/marketplace', 4, true, ARRAY['client','member','admin']),
  ('Recruitment', 'Manage applicants, events, and evaluations.',                              'users',    '/dashboard/recruitment', 5, true, ARRAY['member','admin']),
  ('Settings',    'Manage your profile, availability, and external connections.',             'settings', '/dashboard/settings',    6, true, ARRAY['client','member','admin']),
  ('Admin',       'System administration panel.',                                             'shield',   '/dashboard/admin',       7, true, ARRAY['admin'])
ON CONFLICT DO NOTHING;

-- Admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) VALUES
  ('lfgonzalezm0@outlook.com', '$2b$12$AiqpNcugmvmHp8Yz5vIsdujlyF7MoVMYOi9wT/wHfxyzEcGK/yGy6', 'Fernando', 'González', 'admin', true)
ON CONFLICT (email) DO UPDATE SET role = 'admin', is_verified = true;
