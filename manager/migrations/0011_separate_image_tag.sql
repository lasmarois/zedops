-- M9.8.32: Separate image and tag fields
-- This fixes the bug where image_tag was being overwritten with full image reference
-- causing rebuild failures with "invalid reference format"

-- Add new 'image' column for per-server image override (nullable = use agent default)
ALTER TABLE servers ADD COLUMN image TEXT;

-- Migrate existing data:
-- If image_tag contains a colon (full reference), extract the tag portion
-- Otherwise, keep image_tag as-is (it's already just a tag)

-- For servers with full reference in image_tag, extract just the tag
-- SQLite doesn't have a direct way to do this in UPDATE, so we handle it in code
-- after migration by running a data fix query

-- Note: The actual data migration will be done via wrangler d1 execute after this schema change
-- because SQLite's SUBSTR/INSTR behavior with complex strings needs careful handling
