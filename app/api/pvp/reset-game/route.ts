import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

/**
 * Reset PvP game to allow "Play Again" without recreating lobby
 * - Clears game scores and answers
 * - Resets status to 'waiting' for new game setup
 * - Keeps lobby configuration (category, subcategory, timer, etc)
 * - Questions cache is cleared so new questions are generated
 */
export async function POST(request: NextRequest) {
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
    const rateLimitResult = checkRateLimit(`reset-game-${user.id}`, RATE_LIMITS.NORMAL);
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

    const { lobbyId } = await request.json();

    if (!lobbyId) {
      return NextResponse.json(
        { error: 'Missing lobbyId' },
        { status: 400 }
      );
    }

    // Fetch lobby data
    const { data: lobby, error: fetchError } = await supabase
      .from('pvp_lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchError || !lobby) {
      return NextResponse.json(
        { error: 'Lobby not found' },
        { status: 404 }
      );
    }

    // Verify user is host (only host can reset)
    if (user.id !== lobby.host_user_id) {
      return NextResponse.json(
        { error: 'Only host can reset the game' },
        { status: 403 }
      );
    }

    // Determine new status based on whether Player 2 is still in lobby
    let newStatus = 'opponent_joined'; // If Player 2 is there, wait for their ready
    if (!lobby.joined_user_id) {
      newStatus = 'waiting'; // If Player 2 left, wait for them to join again
    }

    // Reset lobby for new game
    const { error: updateError } = await supabase
      .from('pvp_lobbies')
      .update({
        // Reset game status and scores
        status: newStatus,
        host_score: null,
        joined_score: null,
        started_at: null,
        
        // Clear game statistics
        host_total_questions: 0,
        host_correct_answers: 0,
        host_wrong_answers: 0,
        host_accuracy_percent: null,
        host_total_time_ms: null,
        host_avg_time_per_question_ms: null,
        host_fastest_answer_ms: null,
        host_slowest_answer_ms: null,
        
        joined_total_questions: 0,
        joined_correct_answers: 0,
        joined_wrong_answers: 0,
        joined_accuracy_percent: null,
        joined_total_time_ms: null,
        joined_avg_time_per_question_ms: null,
        joined_fastest_answer_ms: null,
        joined_slowest_answer_ms: null,
        
        // Clear cached questions for fresh generation
        questions_data: null,
        
        // Reset player ready status (Player 2 must ready again)
        player2_ready: false,
        
        // Update timestamp for activity tracking
        updated_at: new Date().toISOString(),
      })
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Error resetting game:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset game' },
        { status: 500 }
      );
    }

    console.log(`✅ Game reset for lobby ${lobbyId}. New status: ${newStatus}`);

    return NextResponse.json({
      success: true,
      message: 'Game reset successfully. Ready to play again!',
      newStatus,
    });
  } catch (error) {
    console.error('Error in reset-game:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
