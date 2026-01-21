import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting: 20 requests per minute per user
    const rateLimitResult = checkRateLimit(`userStats-${user.id}`, RATE_LIMITS.LENIENT);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Get user stats
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Count words due today
    const today = new Date().toISOString().split('T')[0];
    const { count: wordsDueCount } = await supabase
      .from('user_vocab_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lte('next_due', today)
      .not('fluency', 'is', null);

    // Get total words learned (words with at least 1 correct answer)
    const { count: wordsLearnedCount } = await supabase
      .from('user_vocab_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('correct_count', 0);

    // Calculate XP progress to next level
    // Simple linear system: Every level needs 100 XP
    const currentLevelXp = (userData.level - 1) * 100;
    
    const xpProgress = userData.xp - currentLevelXp;
    const xpNeeded = 100; // Fixed 100 XP per level
    const progressPercentage = (xpProgress / xpNeeded) * 100;

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        username: userData.username,
        email: user.email,
        xp: userData.xp,
        level: userData.level,
        streak: userData.streak,
        display_name: userData.display_name,
        last_activity_date: userData.last_activity_date,
        created_at: userData.created_at,
      },
      stats: {
        words_due_today: wordsDueCount || 0,
        words_learned: wordsLearnedCount || 0,
        xp_progress: Math.round(xpProgress),
        xp_needed: xpNeeded,
        progress_percentage: Math.round(progressPercentage),
      },
    });

  } catch (error: Error | unknown) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
