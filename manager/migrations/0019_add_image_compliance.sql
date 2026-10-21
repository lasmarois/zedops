-- Migration: Add image_compliance column to servers table
-- Stores compliance check report as JSON blob (nullable for legacy servers)
ALTER TABLE servers ADD COLUMN image_compliance TEXT;
