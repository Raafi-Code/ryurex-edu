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

    // OPTIMIZED: Use RPC function to get all stats in ONE database call
    // Instead of 3 separate queries, database aggregates everything
    const { data: statsData, error: rpcError } = await supabase
      .rpc('get_user_stats', { p_user_id: user.id });

    if (rpcError || !statsData || statsData.length === 0) {
      console.error('Error calling get_user_stats RPC:', rpcError);
      return NextResponse.json(
        { error: 'Failed to fetch user stats' },
        { status: 500 }
      );
    }

    const stats = statsData[0];

    // Calculate XP progress to next level
    // Simple linear system: Every level needs 100 XP
    const currentLevelXp = (stats.level - 1) * 100;
    const xpProgress = stats.xp - currentLevelXp;
    const xpNeeded = 100; // Fixed 100 XP per level
    const progressPercentage = (xpProgress / xpNeeded) * 100;

    return NextResponse.json({
      success: true,
      user: {
        id: stats.user_id,
        username: stats.username,
        email: user.email,
        xp: stats.xp,
        level: stats.level,
        streak: stats.streak,
        display_name: stats.display_name,
        last_activity_date: stats.last_activity_date,
        created_at: stats.created_at,
      },
      stats: {
        words_due_today: stats.words_due_today || 0,
        words_learned: stats.words_learned || 0,
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
