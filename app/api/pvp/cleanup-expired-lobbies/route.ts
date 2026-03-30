import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Delete lobbies that have expired (more than 5 minutes old and still in 'waiting' status)
    const { error, data } = await supabase
      .from('learn_pvp_lobbies')
      .delete()
      .eq('status', 'waiting')
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.error('Error deleting expired lobbies:', error);
      return NextResponse.json(
        { error: 'Failed to cleanup expired lobbies' },
        { status: 500 }
      );
    }

    console.log('✅ Expired lobbies cleaned up');

    return NextResponse.json({
      success: true,
      message: 'Expired lobbies deleted successfully',
    });
  } catch (error) {
    console.error('Error in cleanup-expired-lobbies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
