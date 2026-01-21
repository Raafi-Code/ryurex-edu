import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  xp: number;
  rank: number;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ User not authenticated');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(`leaderboard-${user.id}`, RATE_LIMITS.LENIENT);
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

    console.log('🔐 Current user:', user.id);

    // Get top 10 users by XP (leaderboard)
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('users')
      .select('id, display_name, xp')
      .order('xp', { ascending: false })
      .limit(10);

    if (leaderboardError) {
      console.error('❌ Error fetching leaderboard:', leaderboardError);
      return NextResponse.json(
        { error: `Failed to fetch leaderboard: ${leaderboardError.message}` },
        { status: 500 }
      );
    }

    console.log('📊 Leaderboard data fetched:', leaderboardData?.length || 0, 'users');

    // Add rank to leaderboard
    const leaderboard: LeaderboardEntry[] = (leaderboardData || []).map(
      (entry, index) => ({
        user_id: entry.id,
        display_name: entry.display_name || 'Unknown User',
        xp: entry.xp || 0,
        rank: index + 1,
      })
    );

    // Get current user's rank
    const { data: allUsersData, error: allUsersError } = await supabase
      .from('users')
      .select('id, xp')
      .order('xp', { ascending: false });

    if (allUsersError) {
      console.error('❌ Error fetching all users:', allUsersError);
      return NextResponse.json(
        { error: `Failed to fetch user rank: ${allUsersError.message}` },
        { status: 500 }
      );
    }

    console.log('� All users data fetched:', allUsersData?.length || 0, 'users');

    const userRank =
      (allUsersData || []).findIndex((u) => u.id === user.id) + 1 || null;

    console.log('🏆 User rank:', userRank);

    // Get current user's data
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('users')
      .select('display_name, xp')
      .eq('id', user.id)
      .single();

    if (currentUserError) {
      console.error('❌ Error fetching current user:', currentUserError);
      return NextResponse.json(
        { error: `Failed to fetch current user data: ${currentUserError.message}` },
        { status: 500 }
      );
    }

    console.log('✅ Leaderboard data ready');

    return NextResponse.json({
      success: true,
      leaderboard,
      userRank,
      currentUser: {
        id: user.id,
        display_name: currentUserData?.display_name || 'Unknown User',
        xp: currentUserData?.xp || 0,
      },
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
