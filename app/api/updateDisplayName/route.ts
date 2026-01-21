import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting: 5 requests per minute per user
    const rateLimitResult = checkRateLimit(`updateDisplay-${user.id}`, RATE_LIMITS.STRICT);
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

    // Get request body
    const body = await req.json();
    const { display_name } = body;

    // Validate display_name
    if (!display_name || typeof display_name !== 'string') {
      return NextResponse.json(
        { error: 'Invalid display_name provided' },
        { status: 400 }
      );
    }

    // Trim and validate length
    const trimmedDisplayName = display_name.trim();
    if (trimmedDisplayName.length === 0 || trimmedDisplayName.length > 50) {
      return NextResponse.json(
        { error: 'Display name must be between 1 and 50 characters' },
        { status: 400 }
      );
    }

    // Update user's display_name
    const { data, error } = await supabase
      .from('users')
      .update({ display_name: trimmedDisplayName })
      .eq('id', user.id)
      .select('id, username, display_name')
      .single();

    if (error) {
      console.error('❌ Error updating display_name:', error);
      return NextResponse.json(
        { error: 'Failed to update display name' },
        { status: 500 }
      );
    }

    console.log('✅ Display name updated for user:', user.id);

    return NextResponse.json({
      success: true,
      message: 'Display name updated successfully',
      user: data,
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
