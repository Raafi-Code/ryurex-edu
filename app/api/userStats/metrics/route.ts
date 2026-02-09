import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/userStats/metrics - Get comprehensive user metrics
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call RPC function to get user metrics
    const { data, error } = await supabase.rpc('get_user_metrics', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('RPC Error (get_user_metrics):', error);
      return NextResponse.json(
        { error: 'Failed to fetch user metrics', details: error.message },
        { status: 500 }
      );
    }

    // Extract first row (should only be one)
    const metrics = data && data.length > 0 ? data[0] : null;

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error in /api/userStats/metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
