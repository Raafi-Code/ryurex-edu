import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

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

    const { lobbyId, playerRole, finalScore, gameStats } = await request.json();

    // Rate limiting
    const rateLimitResult = checkRateLimit(`submit-score-${user.id}`, RATE_LIMITS.NORMAL);
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

    if (!lobbyId || !playerRole || finalScore === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user is in this lobby
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

    // Verify user is host or joined_user
    if (playerRole === 'host' && user.id !== lobby.host_user_id) {
      return NextResponse.json(
        { error: 'Unauthorized: Not the host' },
        { status: 403 }
      );
    }

    if (playerRole === 'joined' && user.id !== lobby.joined_user_id) {
      return NextResponse.json(
        { error: 'Unauthorized: Not the joined player' },
        { status: 403 }
      );
    }

    // Prepare update data with stats if provided
    const updateData: any = {
      ...(playerRole === 'host' ? { host_score: finalScore } : { joined_score: finalScore }),
    };

    // Add stats to update data if provided
    if (gameStats) {
      const prefix = playerRole === 'host' ? 'host' : 'joined';
      updateData[`${prefix}_total_questions`] = gameStats.totalQuestions;
      updateData[`${prefix}_correct_answers`] = gameStats.correctAnswers;
      updateData[`${prefix}_wrong_answers`] = gameStats.wrongAnswers;
      updateData[`${prefix}_accuracy_percent`] = gameStats.accuracyPercent;
      updateData[`${prefix}_total_time_ms`] = gameStats.totalTimeMs;
      updateData[`${prefix}_avg_time_per_question_ms`] = gameStats.avgTimePerQuestionMs;
      updateData[`${prefix}_fastest_answer_ms`] = gameStats.fastestAnswerMs;
      updateData[`${prefix}_slowest_answer_ms`] = gameStats.slowestAnswerMs;
    }

    // Update lobby with score and stats
    const { error: updateError } = await supabase
      .from('pvp_lobbies')
      .update(updateData)
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Error updating score and stats:', updateError);
      return NextResponse.json(
        { error: 'Failed to submit score' },
        { status: 500 }
      );
    }

    console.log('✅ Score and stats submitted:', { finalScore, gameStats });

    return NextResponse.json({
      success: true,
      message: 'Score and stats submitted successfully',
    });
  } catch (error) {
    console.error('Error in submit-score:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
