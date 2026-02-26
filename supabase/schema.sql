-- ============================================
-- Ryurex Edu Vocab Game - Database Schema
-- Phase 3: Dashboard & Vocab Game
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table 1: users (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  display_name text,
  xp integer DEFAULT 0,
  streak integer DEFAULT 0,
  last_activity_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);

-- ============================================
-- Table 2: vocab_master
-- ============================================
CREATE TABLE IF NOT EXISTS public.vocab_master (
  id serial PRIMARY KEY,
  indo text NOT NULL,
  english_primary text NOT NULL, -- Primary English word (used for underscore display)
  synonyms text[] DEFAULT '{}', -- Array of accepted synonyms
  class text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vocab_class ON public.vocab_master(class);

-- ============================================
-- Table 2b: categories (Master Category Table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL, -- e.g. 'Daily Life', 'Family', 'Kitchen'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table 2c: vocab_category_mapping (Many-to-Many Junction)
-- ============================================
CREATE TABLE IF NOT EXISTS public.vocab_category_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vocab_id INTEGER REFERENCES vocab_master(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  subcategory_name TEXT NOT NULL, -- Topic name, e.g. 'Main Family', 'Kitchen Tools'
  order_priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapping_category ON public.vocab_category_mapping(category_id);
CREATE INDEX IF NOT EXISTS idx_mapping_subcategory ON public.vocab_category_mapping(subcategory_name);
CREATE INDEX IF NOT EXISTS idx_mapping_vocab ON public.vocab_category_mapping(vocab_id);

-- ============================================
-- Table 3: user_vocab_progress
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_vocab_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vocab_id integer NOT NULL REFERENCES public.vocab_master(id) ON DELETE CASCADE,
  fluency float DEFAULT 0 CHECK (fluency >= 0 AND fluency <= 10),
  next_due date DEFAULT CURRENT_DATE,
  last_reviewed timestamp with time zone,
  response_avg float DEFAULT 0,
  correct_count integer DEFAULT 0,
  wrong_count integer DEFAULT 0,
  xp_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, vocab_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_vocab_user_id ON public.user_vocab_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vocab_next_due ON public.user_vocab_progress(next_due);
CREATE INDEX IF NOT EXISTS idx_user_vocab_fluency ON public.user_vocab_progress(fluency);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocab_progress ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own data"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Vocab master policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view vocab"
  ON public.vocab_master FOR SELECT
  TO authenticated
  USING (true);

-- Categories: read-only for all authenticated users
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

-- Mapping: read-only for all authenticated users
ALTER TABLE public.vocab_category_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view vocab_category_mapping"
  ON public.vocab_category_mapping FOR SELECT
  TO authenticated
  USING (true);

-- User vocab progress policies
CREATE POLICY "Users can view own progress"
  ON public.user_vocab_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_vocab_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_vocab_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON public.user_vocab_progress FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Triggers for updated_at timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_vocab_progress_updated_at
  BEFORE UPDATE ON public.user_vocab_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Function: Initialize user on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name, xp, streak)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    0,
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile on auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Function: Increment User XP (for batch updates)
-- ============================================

CREATE OR REPLACE FUNCTION public.increment_user_xp(
  user_id_input uuid,
  xp_amount integer
)
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET 
    xp = xp + xp_amount,
    updated_at = now()
  WHERE id = user_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Table 4: pvp_lobbies (PvP Game Lobbies)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pvp_lobbies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Players
  host_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Game Configuration
  game_code text NOT NULL UNIQUE,
  category text NOT NULL,
  subcategory smallint NOT NULL,  -- 0 = random, 1-5 = custom
  num_questions smallint NOT NULL CHECK (num_questions >= 1),
  timer_duration smallint NOT NULL CHECK (timer_duration >= 5),
  game_mode text NOT NULL,  -- 'vocab' atau 'sentence'
  random_seed text,  -- Untuk random mode consistency
  
  -- Game Status
  status text DEFAULT 'waiting',
    -- 'waiting' = menunggu player 2 join
    -- 'opponent_joined' = player 2 joined, waiting host approval
    -- 'ready' = kedua player ready
    -- 'in_progress' = game sedang berjalan
    -- 'finished' = game selesai
  host_approved boolean,
  player2_ready boolean DEFAULT false,
  
  -- Scores
  host_score integer,
  joined_score integer,
  
  -- Host Player Stats
  host_total_questions smallint,
  host_correct_answers smallint,
  host_wrong_answers smallint,
  host_accuracy_percent smallint,
  host_total_time_ms integer,
  host_avg_time_per_question_ms integer,
  host_fastest_answer_ms integer,
  host_slowest_answer_ms integer,
  host_questions_data jsonb,  -- Detailed answer data (vocab_id, answer, isCorrect, timeTakenMs, etc)
  
  -- Joined Player Stats
  joined_total_questions smallint,
  joined_correct_answers smallint,
  joined_wrong_answers smallint,
  joined_accuracy_percent smallint,
  joined_total_time_ms integer,
  joined_avg_time_per_question_ms integer,
  joined_fastest_answer_ms integer,
  joined_slowest_answer_ms integer,
  joined_questions_data jsonb,  -- Detailed answer data (vocab_id, answer, isCorrect, timeTakenMs, etc)
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  expires_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes for pvp_lobbies
CREATE INDEX IF NOT EXISTS idx_pvp_lobbies_host_user_id ON public.pvp_lobbies(host_user_id);
CREATE INDEX IF NOT EXISTS idx_pvp_lobbies_joined_user_id ON public.pvp_lobbies(joined_user_id);
CREATE INDEX IF NOT EXISTS idx_pvp_lobbies_game_code ON public.pvp_lobbies(game_code);
CREATE INDEX IF NOT EXISTS idx_pvp_lobbies_status ON public.pvp_lobbies(status);
CREATE INDEX IF NOT EXISTS idx_pvp_lobbies_created_at ON public.pvp_lobbies(created_at DESC);

-- ============================================
-- Row Level Security (RLS) for pvp_lobbies
-- ============================================
ALTER TABLE public.pvp_lobbies ENABLE ROW LEVEL SECURITY;

-- Players can view lobbies they're involved in
CREATE POLICY "Players can view their lobbies"
  ON public.pvp_lobbies FOR SELECT
  USING (
    auth.uid() = host_user_id 
    OR auth.uid() = joined_user_id
    OR status = 'waiting'  -- Anyone can view waiting lobbies to join
  );

-- Host can insert lobbies
CREATE POLICY "Users can create lobbies"
  ON public.pvp_lobbies FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

-- Host can update their lobby
CREATE POLICY "Host can update their lobby"
  ON public.pvp_lobbies FOR UPDATE
  USING (auth.uid() = host_user_id);

-- Player 2 can join (update joined_user_id and status)
CREATE POLICY "Player 2 can join lobby"
  ON public.pvp_lobbies FOR UPDATE
  USING (
    auth.uid() != host_user_id  -- Not the host
    AND (joined_user_id IS NULL OR joined_user_id = auth.uid())  -- Either no one joined yet, or it's the same user
  )
  WITH CHECK (
    joined_user_id = auth.uid()  -- Only allow setting joined_user_id to current user
  );

-- ============================================
-- Stored Functions & RPC Endpoints
-- ============================================

-- Get category statistics with aggregated count
-- Returns: category name, total vocab count, learned vocab count per user
-- Used by: Categories browse API to avoid fetching massive rows
-- SECURITY DEFINER: Run with postgres role (creator), not calling user
-- Safe because filtered by user_id in WHERE clause
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

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION get_category_stats(UUID) TO authenticated;

-- Get user statistics aggregated efficiently
-- Returns: user info + words due today + words learned (all in ONE database call)
-- Used by: Dashboard to display user stats without 3 separate queries
-- Level is calculated from XP: level = FLOOR(xp / 100) + 1
-- SECURITY DEFINER: Run with postgres role (creator), not calling user
-- Safe because filtered by user_id in WHERE clause
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  display_name TEXT,
  email TEXT,
  xp INTEGER,
  level INTEGER,
  streak INTEGER,
  last_activity_date DATE,
  created_at TIMESTAMP WITH TIME ZONE,
  words_due_today BIGINT,
  words_learned BIGINT
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.username,
    u.display_name,
    a.email::TEXT,
    u.xp,
    (u.xp / 100)::INTEGER + 1 as level,
    COALESCE(u.streak, 0)::INTEGER,
    u.last_activity_date,
    u.created_at,
    COUNT(DISTINCT CASE WHEN uvp.next_due <= CURRENT_DATE AND uvp.fluency IS NOT NULL THEN uvp.vocab_id END)::BIGINT as words_due_today,
    COUNT(DISTINCT CASE WHEN uvp.correct_count > 0 THEN uvp.vocab_id END)::BIGINT as words_learned
  FROM users u
  LEFT JOIN auth.users a ON u.id = a.id
  LEFT JOIN user_vocab_progress uvp ON u.id = uvp.user_id
  WHERE u.id = p_user_id
  GROUP BY u.id, u.username, u.display_name, a.email::TEXT, u.xp, u.streak, u.last_activity_date, u.created_at;
END;
$$;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;

-- Daily Learning Statistics (for progress tracking)
-- Returns: date, words newly learned that day, words reviewed that day, accuracy, cumulative total
-- Supports: Last 7 days, 1 month, 3 months, 6 months, 1 year
CREATE OR REPLACE FUNCTION get_daily_stats(p_user_id UUID, p_days INT DEFAULT 7)
RETURNS TABLE(
  day DATE,
  words_learned_today INT,
  words_reviewed_today INT,
  correct_answers INT,
  total_answers INT,
  accuracy_percent NUMERIC,
  cumulative_total INT
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
BEGIN
  v_start_date := CURRENT_DATE - (p_days || ' days')::INTERVAL;
  
  RETURN QUERY
  WITH daily_new_words AS (
    -- Words newly learned on each day (based on created_at)
    SELECT 
      DATE(uvp.created_at) as day,
      COUNT(DISTINCT uvp.vocab_id) as new_words_count
    FROM user_vocab_progress uvp
    WHERE uvp.user_id = p_user_id
      AND DATE(uvp.created_at) >= v_start_date
    GROUP BY DATE(uvp.created_at)
  ),
  daily_reviews AS (
    -- Words reviewed and their accuracy on each day (based on updated_at)
    SELECT 
      DATE(uvp.updated_at) as day,
      COUNT(DISTINCT uvp.vocab_id) as reviewed_count,
      COALESCE(SUM(uvp.correct_count), 0)::INT as correct_count,
      COALESCE(SUM(uvp.correct_count + uvp.wrong_count), 0)::INT as total_count
    FROM user_vocab_progress uvp
    WHERE uvp.user_id = p_user_id
      AND DATE(uvp.updated_at) >= v_start_date
      AND uvp.fluency > 0
    GROUP BY DATE(uvp.updated_at)
  ),
  cumulative_learned AS (
    -- Cumulative total of words learned up to each day
    SELECT 
      DATE(uvp.created_at) as day,
      COUNT(DISTINCT uvp.vocab_id) as total_learned
    FROM user_vocab_progress uvp
    WHERE uvp.user_id = p_user_id
      AND DATE(uvp.created_at) <= CURRENT_DATE
    GROUP BY DATE(uvp.created_at)
  )
  SELECT 
    d.day,
    COALESCE(dnw.new_words_count, 0)::INT,
    COALESCE(dr.reviewed_count, 0)::INT,
    COALESCE(dr.correct_count, 0)::INT,
    COALESCE(dr.total_count, 0)::INT,
    CASE 
      WHEN COALESCE(dr.total_count, 0) = 0 THEN 0
      ELSE ROUND((COALESCE(dr.correct_count, 0)::NUMERIC / dr.total_count) * 100, 1)
    END::NUMERIC,
    (
      SELECT COALESCE(SUM(total_learned), 0)::INT
      FROM cumulative_learned cl
      WHERE cl.day <= d.day
    )
  FROM (
    -- Generate all dates in range
    SELECT (CURRENT_DATE - ((row_number() OVER (ORDER BY d) - 1) || ' days')::INTERVAL)::DATE as day
    FROM (SELECT 0 as d UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
          UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) nums
    LIMIT p_days
  ) d
  LEFT JOIN daily_new_words dnw ON d.day = dnw.day
  LEFT JOIN daily_reviews dr ON d.day = dr.day
  ORDER BY d.day DESC;
END;
$$;

-- Detailed user metrics (comprehensive stats)
-- Returns: overall metrics for dashboard cards
CREATE OR REPLACE FUNCTION get_user_metrics(p_user_id UUID)
RETURNS TABLE(
  total_words_learned INT,
  new_words_today INT,
  studied_today INT,
  total_correct_answers INT,
  total_attempts INT,
  overall_accuracy_percent NUMERIC,
  current_streak INT,
  longest_streak INT,
  average_fluency NUMERIC
) 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT CASE WHEN uvp.correct_count > 0 THEN uvp.vocab_id END)::INT as total_words,
    COUNT(DISTINCT CASE WHEN DATE(uvp.created_at) = CURRENT_DATE THEN uvp.vocab_id END)::INT as new_today,
    COUNT(DISTINCT CASE WHEN DATE(uvp.updated_at) = CURRENT_DATE THEN uvp.vocab_id END)::INT as studied_today,
    COALESCE(SUM(uvp.correct_count), 0)::INT as total_correct,
    COALESCE(SUM(uvp.correct_count + uvp.wrong_count), 0)::INT as total_attempts,
    CASE 
      WHEN COALESCE(SUM(uvp.correct_count + uvp.wrong_count), 0) = 0 THEN 0
      ELSE ROUND((COALESCE(SUM(uvp.correct_count), 0)::NUMERIC / SUM(uvp.correct_count + uvp.wrong_count)) * 100, 1)
    END::NUMERIC as accuracy,
    COALESCE(MAX(u.streak), 0)::INT as current_streak,
    0::INT as longest_streak,
    ROUND(AVG(COALESCE(uvp.fluency, 0))::NUMERIC, 1) as avg_fluency
  FROM user_vocab_progress uvp
  LEFT JOIN users u ON uvp.user_id = u.id
  WHERE uvp.user_id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_stats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_metrics(UUID) TO authenticated;

-- ============================================
-- NOTES
-- ============================================
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Make sure to seed vocab_master table (see seed_vocab_data.sql)
-- 3. Test RLS policies by querying as authenticated user
-- 4. User profile is auto-created when user signs up
-- 5. PvP lobbies expire after 5 minutes if no one joins
-- 6. Scores are calculated locally on client, submitted to server at game end
-- 7. RPC function get_category_stats() aggregates category stats at database level
--    for optimal performance when browsing categories (no row limit issues)
```
