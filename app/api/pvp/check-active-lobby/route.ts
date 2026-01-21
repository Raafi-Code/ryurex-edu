import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(`check-active-lobby-${user.id}`, RATE_LIMITS.NORMAL);
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

    // Check if user has an active lobby as host
    const { data: hostLobby, error: hostError } = await supabase
      .from('pvp_lobbies')
      .select('id, game_code, status, expires_at')
      .eq('host_user_id', user.id)
      .in('status', ['waiting', 'opponent_joined', 'ready'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (hostError && hostError.code !== 'PGRST116') {
      console.error('Error checking host lobby:', hostError);
      return NextResponse.json(
        { error: 'Failed to check lobbies' },
        { status: 500 }
      );
    }

    // Check if user has an active lobby as joined player
    const { data: joinedLobby, error: joinedError } = await supabase
      .from('pvp_lobbies')
      .select('id, game_code, status, expires_at')
      .eq('joined_user_id', user.id)
      .in('status', ['opponent_joined', 'ready', 'in_progress'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (joinedError && joinedError.code !== 'PGRST116') {
      console.error('Error checking joined lobby:', joinedError);
      return NextResponse.json(
        { error: 'Failed to check lobbies' },
        { status: 500 }
      );
    }

    // Prioritize host lobby, then joined lobby
    const activeLobby = hostLobby || joinedLobby;

    if (activeLobby) {
      return NextResponse.json({
        hasActiveLobby: true,
        lobby: {
          id: activeLobby.id,
          gameCode: activeLobby.game_code,
          status: activeLobby.status,
        },
      });
    }

    return NextResponse.json({
      hasActiveLobby: false,
      lobby: null,
    });
  } catch (error) {
    console.error('Error in check-active-lobby:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
