-- ============================================
-- Migration: Drop Legacy Columns from vocab_master
-- ============================================
-- This migration removes the legacy `category` and `subcategory` columns
-- from `vocab_master` since all queries now use the normalized
-- `categories` + `vocab_category_mapping` tables.
--
-- IMPORTANT: Only run this AFTER confirming all data has been migrated
-- to the new tables via migration_v2_many_to_many.sql
-- ============================================

-- Step 1: Drop legacy indexes
DROP INDEX IF EXISTS idx_vocab_category;
DROP INDEX IF EXISTS idx_vocab_subcategory;

-- Step 2: Drop legacy columns
ALTER TABLE public.vocab_master DROP COLUMN IF EXISTS category;
ALTER TABLE public.vocab_master DROP COLUMN IF EXISTS subcategory;
