-- ============================================
-- Migration V2: Many-to-Many Category System
-- Supports: Synonyms, Dynamic Subcategories, Cross-Category Progress
-- ============================================

-- ============================================
-- Step 1: Transform vocab_master table
-- ============================================

-- Rename english → english_primary (used for underscore display in UI)
ALTER TABLE vocab_master 
RENAME COLUMN english TO english_primary;

-- Add synonyms array column
ALTER TABLE vocab_master 
ADD COLUMN synonyms text[] DEFAULT '{}';

-- ============================================
-- Step 2: Create categories master table
-- ============================================

CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, -- e.g. 'Daily Life', 'Family', 'Kitchen'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Step 3: Create vocab_category_mapping (junction table)
-- ============================================

CREATE TABLE IF NOT EXISTS public.vocab_category_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vocab_id INTEGER REFERENCES vocab_master(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    subcategory_name TEXT NOT NULL, -- Topic name, e.g. 'Main Family', 'Kitchen Tools'
    order_priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Step 4: Indexes for performance
-- ============================================

CREATE INDEX idx_mapping_category ON vocab_category_mapping(category_id);
CREATE INDEX idx_mapping_subcategory ON vocab_category_mapping(subcategory_name);
CREATE INDEX idx_mapping_vocab ON vocab_category_mapping(vocab_id);

-- ============================================
-- Step 5: RLS Policies for new tables
-- ============================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_category_mapping ENABLE ROW LEVEL SECURITY;

-- Categories: read-only for all authenticated users
CREATE POLICY "Authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

-- Mapping: read-only for all authenticated users
CREATE POLICY "Authenticated users can view vocab_category_mapping"
  ON public.vocab_category_mapping FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- Step 6: Migrate existing data
-- ============================================

-- 6a. Populate categories from existing distinct category values
INSERT INTO categories (name)
SELECT DISTINCT category 
FROM vocab_master 
WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 6b. Populate vocab_category_mapping from existing category+subcategory
INSERT INTO vocab_category_mapping (vocab_id, category_id, subcategory_name, order_priority)
SELECT 
    vm.id,
    c.id,
    'Part ' || vm.subcategory::TEXT,  -- Convert numeric subcategory to "Part N"
    vm.subcategory  -- Use existing subcategory number as order_priority
FROM vocab_master vm
JOIN categories c ON c.name = vm.category
WHERE vm.category IS NOT NULL;

-- ============================================
-- Step 7: Update RPC functions for new schema
-- ============================================

-- Updated get_category_stats to use categories + mapping tables
CREATE OR REPLACE FUNCTION get_category_stats(p_user_id UUID)
RETURNS TABLE(
  category TEXT,
  total_count BIGINT,
  learned_count BIGINT
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name AS category,
    COUNT(DISTINCT vcm.vocab_id)::BIGINT as total_count,
    COUNT(DISTINCT CASE WHEN uvp.fluency > 0 THEN uvp.vocab_id END)::BIGINT as learned_count
  FROM categories c
  JOIN vocab_category_mapping vcm ON c.id = vcm.category_id
  LEFT JOIN user_vocab_progress uvp 
    ON vcm.vocab_id = uvp.vocab_id 
    AND uvp.user_id = p_user_id
  GROUP BY c.name
  ORDER BY c.name ASC;
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_category_stats(UUID) TO authenticated;

-- ============================================
-- NOTES
-- ============================================
-- 1. Run this migration in Supabase SQL Editor
-- 2. After verifying data is correct, you can optionally drop
--    the old category/subcategory columns from vocab_master:
--    ALTER TABLE vocab_master DROP COLUMN category;
--    ALTER TABLE vocab_master DROP COLUMN subcategory;
-- 3. Do NOT drop old columns until all API routes and frontend
--    have been updated and verified working with new schema.
-- 4. The old category/subcategory columns are kept for backward
--    compatibility during the transition period.
