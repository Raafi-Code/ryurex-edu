import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

interface AiModeResult {
  vocab_id: number;
  correct: boolean;
  hintClickCount: number;
}

interface SubmitAiModePayload {
  results: AiModeResult[];
  category: string;
  subcategory: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Rate limiting: 10 requests per minute per user
    const rateLimitResult = checkRateLimit(`ai-submit-${user.id}`, RATE_LIMITS.NORMAL);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          success: false,
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
    const body: SubmitAiModePayload = await req.json();
    const { results, category, subcategory } = body;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid results format', success: false },
        { status: 400 }
      );
    }

    let totalXpGained = 0;

    // Calculate XP from results (client-side scoring only)
    // ⚠️ AI Mode does NOT update user_vocab_progress
    // Only XP is awarded
    for (const result of results) {
      const { correct, hintClickCount } = result;

      // Calculate XP with hint penalty
      let xpGain = 0;
      if (correct) {
        // Correct answer gets XP based on hints
        if (hintClickCount === 0) {
          xpGain = 10; // Full XP - no hint
        } else if (hintClickCount === 1) {
          xpGain = 5; // 50% XP - 1 hint click
        } else {
          xpGain = 1; // Minimal XP - 2+ hint clicks
        }
      } else {
        // Wrong answer = 0 XP (no participation bonus in AI Mode)
        xpGain = 0;
      }

      totalXpGained += xpGain;

      console.log(
        `🤖 AI Mode ${category} (Part ${subcategory}): ${correct ? '✅' : '❌'} | XP: +${xpGain} (hints: ${hintClickCount})`
      );
    }

    // Update user XP only (no vocabulary progress update)
    if (totalXpGained > 0) {
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('xp')
        .eq('id', userId)
        .single();

      if (!userFetchError && userData) {
        const newXp = (userData.xp || 0) + totalXpGained;

        const { error: updateError } = await supabase
          .from('users')
          .update({
            xp: newXp,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (updateError) {
          console.error('❌ Error updating user XP:', updateError);
          return NextResponse.json(
            { error: 'Failed to update XP', success: false },
            { status: 500 }
          );
        }
      }
    }

    // Update streak (if any correct answer)
    const hasCorrect = results.some((r) => r.correct);
    if (hasCorrect) {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: userData } = await supabase
        .from('users')
        .select('last_activity_date, streak')
        .eq('id', userId)
        .single();

      if (userData) {
        const lastActivityDate = new Date(userData.last_activity_date || '2000-01-01')
          .toISOString()
          .split('T')[0];
        const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        let newStreak = userData.streak || 0;
        if (lastActivityDate !== todayStr) {
          newStreak = lastActivityDate === yesterday ? (newStreak || 0) + 1 : 1;
        }

        await supabase
          .from('users')
          .update({
            last_activity_date: todayStr,
            streak: newStreak,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
    }

    console.log(`✅ AI Mode submission complete: +${totalXpGained} XP | Category: ${category} | Part: ${subcategory}`);

    return NextResponse.json({
      success: true,
      message: 'AI Mode score submitted successfully',
      xpGained: totalXpGained,
      resultsProcessed: results.length,
      note: 'AI Mode does not affect vocabulary progress - only XP is awarded',
    });
  } catch (error) {
    console.error('❌ Unexpected error in AI Mode submitScore:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}
