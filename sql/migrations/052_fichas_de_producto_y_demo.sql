-- LAS FICHAS DE LOS DOS PRODUCTOS, CON SU DEMOSTRACIÓN PÚBLICA (2026-08-25).
--
-- Fernando: «actualiza la ficha, y por favor deja configurado en el marketplace un
-- botón de acceso a cada producto en su versión demo, con el dato de la credencial
-- de prueba que pueden ingresar».
--
-- ⚠️ LO QUE SE VE EN EL CATÁLOGO SON LOS `member_portfolio_items`, NO `products`.
-- El catálogo (`/api/portfolio/public?type=product`) lee el portafolio del miembro;
-- `products` es el registro vendible que cuelga de él y alimenta carrito y pedidos.
-- Por eso «Gestión de Reservas» salía hasta hoy en la pestaña **Proyectos**: su ítem
-- tenía `item_type='project'`.

-- ── Campos nuevos ───────────────────────────────────────────────────────────
ALTER TABLE gcc_world.member_portfolio_items
  ADD COLUMN IF NOT EXISTS es_suscripcion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_url       text,
  ADD COLUMN IF NOT EXISTS demo_usuario   text,
  ADD COLUMN IF NOT EXISTS demo_clave     text,
  ADD COLUMN IF NOT EXISTS demo_nota      text;

COMMENT ON COLUMN gcc_world.member_portfolio_items.es_suscripcion IS
  'Si el precio es una MENSUALIDAD. Enseñar «$5,00» a secas en algo que se cobra cada mes es engañar al comprador.';
COMMENT ON COLUMN gcc_world.member_portfolio_items.demo_clave IS
  '⚠️ CREDENCIAL PÚBLICA A PROPÓSITO: se publica en el marketplace para que cualquiera pruebe la demostración. NO es un secreto y no debe reutilizarse en ninguna cuenta real.';

-- ── Ficha 1 · Gestión de Reservas ───────────────────────────────────────────
UPDATE gcc_world.member_portfolio_items
   SET item_type      = 'product',
       title          = 'Gestión de Reservas',
       description    = 'Sistema de reservas para alojamientos: ubicaciones, suites, agenda del día, panel de ocupación y reportes con exportación a Excel. Cada alojamiento entra por su propia dirección, con su nombre, su logo y sus colores.',
       cost           = 5,
       es_suscripcion = true,
       tags           = ARRAY['Hoteles','Suites','Reservas','Multi-inquilino','Excel'],
       project_url    = 'https://reservas-production-e98f.up.railway.app',
       demo_url       = 'https://reservas-production-e98f.up.railway.app/demo/acceso',
       demo_usuario   = 'admin',
       demo_clave     = 'GccDemo2026',
       demo_nota      = 'Alojamiento de demostración: se puede recorrer entero, pero los cambios no se guardan.',
       allow_quantities = false,
       updated_at     = now()
 WHERE id = 1;

-- ── Ficha 2 · Gestión de Pedidos (no existía) ───────────────────────────────
INSERT INTO gcc_world.member_portfolio_items
  (member_id, title, description, cost, es_suscripcion, tags, item_type, talent,
   project_url, demo_url, demo_usuario, demo_clave, demo_nota, allow_quantities, sort_order, updated_at)
SELECT
  1,
  'Gestión de Pedidos',
  'Control de pedidos para negocios de comida: mesas por zonas, carta con precios y disponibilidad, pantalla de cocina, cobro con método de pago e IVA configurable, reservas de mesa y reportes con exportación a Excel.',
  5,
  true,
  ARRAY['Restaurantes','Pedidos','Mesas','Cocina','IVA','Multi-inquilino'],
  'product',
  'Automatización de procesos',
  'https://pedidos-production-0124.up.railway.app',
  'https://pedidos-production-0124.up.railway.app/demo/acceso',
  'admin',
  'GccDemo2026',
  'Prueba también los otros puestos con la misma contraseña: «mesero» ve la sala y «cocina» ve las comandas. Los cambios no se guardan.',
  false,
  1,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM gcc_world.member_portfolio_items WHERE title = 'Gestión de Pedidos' AND member_id = 1
);

-- ── Los registros vendibles ─────────────────────────────────────────────────
UPDATE gcc_world.products
   SET name       = 'Gestión de Reservas',
       price      = 5,
       category   = 'producto',
       is_active  = true,
       allow_quantities = false,
       updated_at = now()
 WHERE id = 2;

INSERT INTO gcc_world.products (name, description, price, image_url, category, stock, is_active, portfolio_item_id, allow_quantities, updated_at)
SELECT
  pi.title, pi.description, 5, pi.image_url, 'producto', 999, true, pi.id, false, now()
  FROM gcc_world.member_portfolio_items pi
 WHERE pi.title = 'Gestión de Pedidos' AND pi.member_id = 1
   AND NOT EXISTS (SELECT 1 FROM gcc_world.products WHERE portfolio_item_id = pi.id);
