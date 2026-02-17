-- Add 'unico' column to productos table if it doesn't exist
-- This enables the "unique product" feature (products with only 1 unit available)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unico BOOLEAN DEFAULT false;
