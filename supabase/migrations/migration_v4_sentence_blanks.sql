-- ============================================
-- Migration V4: Create sentence_blanks table
-- For "Fill the Word" game mode
-- ============================================

-- Table: sentence_blanks
-- Stores Indonesian + English sentence pairs per vocab word
-- The blank_answer is the exact word form to be blanked in sentence_english
-- (may be conjugated/modified, e.g., "run" → "runs", "running")
CREATE TABLE IF NOT EXISTS public.sentence_blanks (
  id SERIAL PRIMARY KEY,
  vocab_id INTEGER NOT NULL REFERENCES public.vocab_master(id) ON DELETE CASCADE,
  sentence_indo TEXT NOT NULL,        -- Full Indonesian sentence
  sentence_english TEXT NOT NULL,     -- Full English sentence (with blank_answer intact)
  blank_answer TEXT NOT NULL,         -- Exact word to blank out (e.g., "runs")
  explanation TEXT,                   -- Grammar explanation (e.g., "Third-person singular requires -s")
  source TEXT DEFAULT 'ai',           -- 'ai' or 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate sentences per vocab
  UNIQUE(vocab_id, sentence_indo)
);

-- Index for fast lookups by vocab_id
CREATE INDEX IF NOT EXISTS idx_sentence_blanks_vocab_id ON public.sentence_blanks(vocab_id);

-- Enable Row Level Security
ALTER TABLE public.sentence_blanks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: read-only for authenticated users (like vocab_master)
CREATE POLICY "Authenticated users can view sentence_blanks"
  ON public.sentence_blanks FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert (for AI-generated sentences via API)
CREATE POLICY "Authenticated users can insert sentence_blanks"
  ON public.sentence_blanks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- Add image_url column to categories table
-- ============================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;
