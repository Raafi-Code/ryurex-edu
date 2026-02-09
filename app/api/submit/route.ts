import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

interface SubmitRequest {
  vocab_id: number;
  correct: boolean;
  time_taken: number; // in seconds
  hintUsed?: boolean;
}

export async function POST(request: NextRequest) {
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

    // Rate limiting: 20 requests per minute per user (lenient for normal gameplay)
    const rateLimitResult = checkRateLimit(`submit-${user.id}`, RATE_LIMITS.LENIENT);
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

    // Parse request body
    const body: SubmitRequest = await request.json();
    const { vocab_id, correct, time_taken, hintUsed } = body;

    if (!vocab_id || typeof correct !== 'boolean' || !time_taken) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Get current progress
    const { data: currentProgress, error: progressError } = await supabase
      .from('user_vocab_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('vocab_id', vocab_id)
      .single();

    if (progressError || !currentProgress) {
      return NextResponse.json(
        { error: 'Vocabulary progress not found' },
        { status: 404 }
      );
    }

    // NEW SYSTEM: Aggressive progression with time-based rewards
    // If hint is used, normal progression rules apply (no bonus)
    // If hint is not used, bonus (+2 for all at ≤5s)
    let fluencyChange = 0;
    let daysUntilNext = 0;
    let newFluency = 0;
    
    const hintWasUsed = hintUsed === true;
    
    if (correct && time_taken <= 5) {
      // ⚡ VERY FAST (≤5s)
      // If hint used: always +1. If no hint: +2 bonus
      if (hintWasUsed) {
        fluencyChange = +1; // Normal progression when hint used
      } else {
        fluencyChange = +2; // Bonus progression without hint
      }
      newFluency = Math.max(0, Math.min(10, currentProgress.fluency + fluencyChange));
      
      // Calculate next review schedule using IMPROVED HYBRID formula
      if (newFluency === 0) {
        daysUntilNext = 0;
      } else if (newFluency === 1) {
        daysUntilNext = 1;
      } else if (newFluency === 2) {
        daysUntilNext = 3;
      } else {
        daysUntilNext = Math.round(7 * Math.pow(1.7, newFluency - 3));
      }
      
    } else if (correct && time_taken > 5 && time_taken < 10) {
      // 🔥 FAST (5-10s) - Normal progression (same for hint or no hint)
      fluencyChange = +1;
      newFluency = Math.max(0, Math.min(10, currentProgress.fluency + fluencyChange));
      
      if (newFluency === 0) {
        daysUntilNext = 0;
      } else if (newFluency === 1) {
        daysUntilNext = 1;
      } else if (newFluency === 2) {
        daysUntilNext = 3;
      } else {
        daysUntilNext = Math.round(7 * Math.pow(1.7, newFluency - 3));
      }
      
    } else if (correct && time_taken >= 10) {
      // ⏱️ SLOW CORRECT (≥10s) - RESET!
      newFluency = 0; // RESET to 0
      daysUntilNext = 0; // Force review TODAY
      
    } else {
      // ❌ WRONG - RESET!
      newFluency = 0; // RESET to 0
      daysUntilNext = 0; // Force review TODAY
    }

    // Calculate next due date
    const todayStr = new Date().toISOString().split('T')[0];
    let nextDueDate;
    
    if (daysUntilNext === 0 || newFluency === 0) {
      // Keep it TODAY - user must practice again
      nextDueDate = todayStr;
    } else {
      // Schedule for future
      const date = new Date();
      date.setDate(date.getDate() + Math.round(daysUntilNext));
      nextDueDate = date.toISOString().split('T')[0];
    }

    const timeStatus = time_taken <= 5 ? '⚡ VERY FAST' : time_taken < 10 ? '🔥 FAST' : time_taken === Infinity ? 'TIMEOUT' : '⏱️ SLOW';
    console.log(`📊 Submit result for vocab_id ${vocab_id}:`);
    console.log(`   ${timeStatus} (${time_taken}s) | Correct: ${correct}`);
    console.log(`   Fluency: ${currentProgress.fluency} → ${newFluency}`);
    console.log(`   Next due: ${nextDueDate} (${daysUntilNext} days)`);

    // Update response average
    const totalResponses = currentProgress.correct_count + currentProgress.wrong_count;
    const currentAvg = currentProgress.response_avg || 0;
    const newResponseAvg = totalResponses === 0
      ? time_taken
      : (currentAvg * totalResponses + time_taken) / (totalResponses + 1);

    // Update progress
    const { error: updateError } = await supabase
      .from('user_vocab_progress')
      .update({
        fluency: newFluency,
        next_due: nextDueDate,
        last_reviewed: new Date().toISOString(),
        response_avg: newResponseAvg,
        correct_count: correct ? currentProgress.correct_count + 1 : currentProgress.correct_count,
        wrong_count: correct ? currentProgress.wrong_count : currentProgress.wrong_count + 1,
      })
      .eq('user_id', user.id)
      .eq('vocab_id', vocab_id);

    if (updateError) {
      throw updateError;
    }

    // Calculate XP gained (with bonus for very fast answers)
    let xpGained = 0;
    if (correct) {
      if (time_taken <= 5) {
        xpGained = 15; // ⚡ Very fast: 15 XP (bonus!)
      } else if (time_taken < 10) {
        xpGained = 10; // 🔥 Fast: 10 XP
      } else {
        xpGained = 0; // ⏱️ Slow correct (reset): 0 XP
      }
    } else {
      xpGained = 0; // ❌ Wrong (reset): 0 XP
    }

    // Get current user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('xp, streak, last_activity_date')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const newXp = userData.xp + xpGained;

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = userData.last_activity_date;
    let newStreak = userData.streak;

    if (lastActivity) {
      const lastDate = new Date(lastActivity);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        newStreak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        newStreak = 1;
      }
      // If same day (diffDays === 0), keep streak unchanged
    } else {
      newStreak = 1;
    }

    // Update user data
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        xp: newXp,
        streak: newStreak,
        last_activity_date: today,
      })
      .eq('id', user.id);

    if (userUpdateError) {
      throw userUpdateError;
    }

    return NextResponse.json({
      success: true,
      result: {
        correct,
        fluency_change: fluencyChange,
        new_fluency: newFluency,
        next_due: nextDueDate, // Already a string in YYYY-MM-DD format
        xp_gained: xpGained,
        new_xp: newXp,
        streak: newStreak,
      },
    });

  } catch (error: Error | unknown) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
