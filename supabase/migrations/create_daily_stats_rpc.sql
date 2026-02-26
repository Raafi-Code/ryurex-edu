-- Create RPC functions for daily learning statistics and user metrics
-- These functions support the /app/progress-stats page for tracking learning progress
-- Supports timeframes: 7d, 1m (30d), 3m (90d), 6m (180d), 1y (365d)
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/[YOUR_PROJECT]/sql/new

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
  total_categories_learned INT,
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
      ELSE ROUND((COALESCE(SUM(uvp.correct_count), 0)::NUMERIC / NULLIF(SUM(uvp.correct_count + uvp.wrong_count), 0)) * 100, 1)
    END::NUMERIC as accuracy,
    COALESCE((SELECT u.streak FROM users u WHERE u.id = p_user_id), 0)::INT as current_streak,
    (
      SELECT COUNT(DISTINCT vcm.category_id)::INT 
      FROM user_vocab_progress uvp2
      JOIN vocab_category_mapping vcm ON uvp2.vocab_id = vcm.vocab_id
      WHERE uvp2.user_id = p_user_id AND uvp2.fluency > 0
    ) as total_categories,
    ROUND(AVG(COALESCE(uvp.fluency, 0))::NUMERIC, 1) as avg_fluency
  FROM user_vocab_progress uvp
  WHERE uvp.user_id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_stats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_metrics(UUID) TO authenticated;
