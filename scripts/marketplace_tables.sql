-- ================================================
-- Marketplace Tables Migration
-- ================================================

-- 1. Extend productos table with new columns
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS imagenes JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS categoria VARCHAR(100),
ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Migrate existing imagen data to imagenes array
UPDATE productos
SET imagenes = CASE
  WHEN imagen IS NOT NULL AND imagen != '' THEN jsonb_build_array(imagen)
  ELSE '[]'::jsonb
END
WHERE imagenes IS NULL OR imagenes = '[]'::jsonb;

-- 3. Create cart_items table
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGSERIAL PRIMARY KEY,
  id_usuario UUID NOT NULL,
  id_producto BIGINT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_usuario, id_producto)
);

-- 4. Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  id_comprador UUID NOT NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'pendiente',
  total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notas TEXT,
  paypal_order_id VARCHAR(255),
  paypal_capture_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  id_order BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria);
CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_id_miembro ON productos(id_miembro);
CREATE INDEX IF NOT EXISTS idx_cart_items_usuario ON cart_items(id_usuario);
CREATE INDEX IF NOT EXISTS idx_orders_comprador ON orders(id_comprador);
CREATE INDEX IF NOT EXISTS idx_orders_estado ON orders(estado);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(id_order);

-- 7. Create trigger for updated_at on productos
CREATE OR REPLACE FUNCTION update_productos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_productos_updated_at ON productos;
CREATE TRIGGER trigger_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION update_productos_updated_at();

-- 8. Create trigger for updated_at on cart_items
CREATE OR REPLACE FUNCTION update_cart_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cart_items_updated_at ON cart_items;
CREATE TRIGGER trigger_cart_items_updated_at
  BEFORE UPDATE ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cart_items_updated_at();

-- 9. Create trigger for updated_at on orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Order states:
-- 'pendiente' - Order created, awaiting payment
-- 'pagado' - Payment received via PayPal
-- 'confirmado' - Seller confirmed the order
-- 'completado' - Order fulfilled
-- 'cancelado' - Order cancelled
