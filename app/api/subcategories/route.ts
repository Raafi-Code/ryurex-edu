import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get category from query params
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    if (!category) {
      return NextResponse.json(
        { error: 'Category parameter is required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(`subcategories-${user.id}`, RATE_LIMITS.LENIENT);
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

    // Get all words in this category grouped by subcategory
    const { data: vocabData, error: vocabError } = await supabase
      .from('vocab_master')
      .select('subcategory, id')
      .eq('category', category)
      .order('subcategory', { ascending: true });

    if (vocabError) {
      console.error('Error fetching subcategories:', vocabError);
      return NextResponse.json(
        { error: 'Failed to fetch subcategories' },
        { status: 500 }
      );
    }

    // Count words per subcategory
    const subcategoryMap = new Map<number, number>();
    vocabData?.forEach((item: { subcategory: number }) => {
      const count = subcategoryMap.get(item.subcategory) || 0;
      subcategoryMap.set(item.subcategory, count + 1);
    });

    // Convert to array
    const subcategories = Array.from(subcategoryMap.entries()).map(([subcategory, count]) => ({
      subcategory,
      word_count: count,
    }));

    // Get total words in category
    const totalWords = vocabData?.length || 0;

    return NextResponse.json({
      success: true,
      category,
      total_words: totalWords,
      subcategories,
      count: subcategories.length,
    });

  } catch (error) {
    console.error('Error in subcategories API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
