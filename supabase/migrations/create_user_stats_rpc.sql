-- Create RPC function to get user statistics efficiently
-- This function aggregates user profile + word stats in ONE database call
-- Level is calculated from XP: level = FLOOR(xp / 100) + 1
-- SECURITY DEFINER: Runs with postgres role permission (not user), safe because filtered by user_id
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/[YOUR_PROJECT]/sql/new

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
