import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface SubmitRequest {
  vocab_id: number;
  correct: boolean;
  time_taken: number; // in seconds
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

    // Parse request body
    const body: SubmitRequest = await request.json();
    const { vocab_id, correct, time_taken } = body;

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
    let fluencyChange = 0;
    let daysUntilNext = 0;
    let newFluency = 0;
    
    if (correct && time_taken <= 5) {
      // ⚡ VERY FAST (≤5s) - Double progression!
      fluencyChange = +2; // Big jump!
      newFluency = Math.max(0, Math.min(10, currentProgress.fluency + fluencyChange));
      
      // Calculate next review schedule using IMPROVED HYBRID formula
      // Updated Rule: if f = 0 → days = 0
      //               if f = 1 → days = 1
      //               if f = 2 → days = 3 (changed from 2)
      //               if f ≥ 3 → days = round(7 × 1.7^(f−3))
      if (newFluency === 0) {
        daysUntilNext = 0;
      } else if (newFluency === 1) {
        daysUntilNext = 1;
      } else if (newFluency === 2) {
        daysUntilNext = 3; // CHANGED from 2 to 3
      } else {
        daysUntilNext = Math.round(7 * Math.pow(1.7, newFluency - 3));
        // f=3→7, f=4→12, f=5→20, f=6→34, f=7→58, f=8→99, f=9→168, f=10→285
      }
      
    } else if (correct && time_taken > 5 && time_taken < 10) {
      // 🔥 FAST (5-10s) - Normal progression
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
