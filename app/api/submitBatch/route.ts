import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

interface GameResult {
  vocab_id: number;
  correct: boolean;
  time_taken: number;
}

interface BatchRequest {
  results: GameResult[];
  mode?: 'practice' | 'spaced-repetition'; // 'practice' = no locking, 'spaced-repetition' = with locking
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting: 10 requests per minute per user (batch operations are expensive)
    const rateLimitResult = checkRateLimit(`submitBatch-${user.id}`, RATE_LIMITS.NORMAL);
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

    const { results, mode = 'spaced-repetition' } = await request.json() as BatchRequest;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid results array' },
        { status: 400 }
      );
    }

    console.log(`📦 Processing batch of ${results.length} results for user ${user.id} [mode: ${mode}]`);

    // Get today's date for comparison
    const todayStr = new Date().toISOString().split('T')[0];

    let totalXpGained = 0;
    const updates = [];

    for (const result of results) {
      const { vocab_id, correct, time_taken } = result;

      // Fetch current progress
      const { data: currentProgress, error: fetchError } = await supabase
        .from('user_vocab_progress')
        .select('fluency, xp_earned, correct_count, wrong_count, response_avg, next_due')
        .eq('user_id', user.id)
        .eq('vocab_id', vocab_id)
        .single();

      if (fetchError) {
        console.error(`❌ Error fetching progress for vocab ${vocab_id}:`, fetchError);
        continue;
      }

      // Check if this word was previously studied (not first time)
      const isPreviouslyStudied = !!currentProgress;
      const isNextDueToday = !isPreviouslyStudied || currentProgress.next_due === todayStr;

      // IMPROVED HYBRID FORMULA: Aggressive progression with time-based rewards
      // Updated Rule: if f = 0 → days = 0
      //               if f = 1 → days = 1
      //               if f = 2 → days = 3 (changed from 2)
      //               if f ≥ 3 → days = round(7 × 1.7^(f−3))
      let fluencyChange = 0;
      let daysUntilNext = 0;
      let newFluency = 0;
      
      if (correct && time_taken <= 5) {
        // ⚡ VERY FAST (≤5s) - Double progression!
        if (mode === 'practice' || isNextDueToday) {
          fluencyChange = +2; // Big jump!
        } else {
          fluencyChange = 0; // Don't increase fluency if not due today (locked)
        }
        
        newFluency = Math.max(0, Math.min(10, currentProgress.fluency + fluencyChange));
        
        if (newFluency === 0) {
          daysUntilNext = 0;
        } else if (newFluency === 1) {
          daysUntilNext = 1;
        } else if (newFluency === 2) {
          daysUntilNext = 3; // CHANGED from 2 to 3
        } else {
          daysUntilNext = Math.round(7 * Math.pow(1.7, newFluency - 3));
        }
        
      } else if (correct && time_taken > 5 && time_taken < 10) {
        // 🔥 FAST (5-10s) - Normal progression
        if (mode === 'practice' || isNextDueToday) {
          fluencyChange = +1; // Normal progression
        } else {
          fluencyChange = 0; // Don't increase fluency if not due today (locked)
        }
        
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

      // Calculate XP gain (with bonus for very fast answers)
      let xpGain = 0;
      if (correct) {
        if (time_taken <= 5) {
          xpGain = 15; // ⚡ Very fast: 15 XP (bonus!)
        } else if (time_taken < 10) {
          xpGain = 10; // 🔥 Fast correct: 10 XP
        } else {
          xpGain = 5;  // ⏱️ Slow correct: 5 XP
        }
      }
      // ❌ Wrong answer or ≥10s reset: 0 XP

      totalXpGained += xpGain;

      // Calculate new response_avg (moving average)
      // Formula: new_avg = (old_avg * total_attempts + current_time) / (total_attempts + 1)
      const totalAttempts = currentProgress.correct_count + currentProgress.wrong_count;
      const newResponseAvg = totalAttempts === 0
        ? time_taken
        : (currentProgress.response_avg * totalAttempts + time_taken) / (totalAttempts + 1);

      // Prepare update
      updates.push({
        vocab_id,
        fluency: newFluency,
        next_due: nextDueDate,
        xp_earned: currentProgress.xp_earned + xpGain,
        correct_count: currentProgress.correct_count + (correct ? 1 : 0),
        wrong_count: currentProgress.wrong_count + (correct ? 0 : 1),
        response_avg: newResponseAvg,
        fluencyChange,
        daysUntilNext,
        correct,
        time_taken,
        xpGain
      });

      console.log(`  📝 vocab_id ${vocab_id}: ${correct ? '✅' : '❌'} in ${time_taken}s → fluency ${currentProgress.fluency}→${newFluency}${correct && !isNextDueToday && time_taken < 10 && mode === 'spaced-repetition' ? ' (locked, next_due not today)' : ''}, next_due: ${nextDueDate}, response_avg: ${newResponseAvg.toFixed(1)}s, XP: +${xpGain}`);
    }

    // Batch update all progress records
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('user_vocab_progress')
        .update({
          fluency: update.fluency,
          next_due: update.next_due,
          xp_earned: update.xp_earned,
          correct_count: update.correct_count,
          wrong_count: update.wrong_count,
          response_avg: update.response_avg,
          last_reviewed: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('vocab_id', update.vocab_id);

      if (updateError) {
        console.error(`❌ Error updating vocab ${update.vocab_id}:`, updateError);
      }
    }

    // Update user's total XP
    const { data: userData, error: userFetchError } = await supabase
      .from('users')
      .select('xp')
      .eq('id', user.id)
      .single();

    if (!userFetchError && userData) {
      const newXp = (userData.xp || 0) + totalXpGained;
      
      const { error: xpError } = await supabase
        .from('users')
        .update({ xp: newXp })
        .eq('id', user.id);

      if (xpError) {
        console.error('❌ Error updating user XP:', xpError);
      }
    }

    // Update streak
    const { data: streakData, error: streakFetchError } = await supabase
      .from('users')
      .select('streak, last_activity_date')
      .eq('id', user.id)
      .single();

    if (!streakFetchError && streakData) {
      const today = new Date().toISOString().split('T')[0];
      const lastActivity = streakData.last_activity_date;
      let newStreak = streakData.streak || 0;

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
        // First time activity
        newStreak = 1;
      }

      // Update streak and last_activity_date
      await supabase
        .from('users')
        .update({
          streak: newStreak,
          last_activity_date: today,
        })
        .eq('id', user.id);

      console.log(`📅 Streak updated: ${newStreak} days`);
    }

    console.log(`✅ Batch update complete! Total XP gained: ${totalXpGained}`);

    return NextResponse.json({
      success: true,
      totalXpGained,
      updatesCount: updates.length,
      details: updates,
    });

  } catch (error) {
    console.error('❌ Error in submitBatch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
