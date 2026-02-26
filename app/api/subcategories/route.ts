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

    // Get category ID from categories table
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError || !categoryData) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get all subcategories (topics) for this category via mapping table
    const { data: mappingData, error: mappingError } = await supabase
      .from('vocab_category_mapping')
      .select('subcategory_name, vocab_id, order_priority')
      .eq('category_id', categoryData.id)
      .order('order_priority', { ascending: true });

    if (mappingError) {
      console.error('Error fetching subcategories:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch subcategories' },
        { status: 500 }
      );
    }

    // Count words per subcategory_name (topic)
    const subcategoryMap = new Map<string, { word_count: number; order_priority: number }>();
    mappingData?.forEach((item: { subcategory_name: string; order_priority: number }) => {
      const existing = subcategoryMap.get(item.subcategory_name);
      if (existing) {
        existing.word_count += 1;
      } else {
        subcategoryMap.set(item.subcategory_name, {
          word_count: 1,
          order_priority: item.order_priority,
        });
      }
    });

    // Convert to array sorted by order_priority
    const subcategories = Array.from(subcategoryMap.entries())
      .map(([subcategory_name, data]) => ({
        subcategory_name,
        word_count: data.word_count,
        order_priority: data.order_priority,
      }))
      .sort((a, b) => a.order_priority - b.order_priority);

    // Get total words in category
    const totalWords = mappingData?.length || 0;

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
