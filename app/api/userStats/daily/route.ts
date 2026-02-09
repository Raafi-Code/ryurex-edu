import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/userStats/daily - Get daily learning statistics
// Query params: days=7 (7d), 30 (1m), 90 (3m), 180 (6m), 365 (1y)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get days parameter from query string (default: 7)
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '7', 10);

    // Validate days parameter
    const validDays = [7, 30, 90, 180, 365];
    if (!validDays.includes(days)) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be one of: 7, 30, 90, 180, 365' },
        { status: 400 }
      );
    }

    // Call RPC function to get daily stats
    const { data, error } = await supabase.rpc('get_daily_stats', {
      p_user_id: user.id,
      p_days: days,
    });

    if (error) {
      console.error('RPC Error (get_daily_stats):', error);
      return NextResponse.json(
        { error: 'Failed to fetch daily stats', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      timeframe: {
        days,
        label: days === 7 ? '7D' : days === 30 ? '1M' : days === 90 ? '3M' : days === 180 ? '6M' : '1Y',
      },
    });
  } catch (error) {
    console.error('Error in /api/userStats/daily:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
