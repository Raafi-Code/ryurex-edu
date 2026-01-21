import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET() {
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

    // Get distinct categories with COUNT
    // Using SQL to aggregate directly (more efficient than fetching all then processing)
    const { data: categoryData, error: categoryError } = await supabase
      .from('vocab_master')
      .select('category', { count: 'exact' })
      .order('category', { ascending: true });

    if (categoryError) {
      console.error('Error fetching categories:', categoryError);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    if (!categoryData || categoryData.length === 0) {
      return NextResponse.json({
        success: true,
        categories: [],
      });
    }

    // Get unique categories
    const uniqueCategories = Array.from(new Set(categoryData.map(c => c.category)));

    // Get vocab IDs per category and user progress in parallel
    const categoryStatsPromises = uniqueCategories.map(async (cat) => {
      // Get vocab IDs for this category
      const { data: vocabData } = await supabase
        .from('vocab_master')
        .select('id, subcategory')
        .eq('category', cat);

      const vocabIds = vocabData?.map(v => v.id) || [];
      const count = vocabIds.length;

      // Get max subcategory for this category
      const maxSubcategory = vocabData && vocabData.length > 0
        ? Math.max(...vocabData.map(v => v.subcategory || 1))
        : 1;

      // Check if this category has sentence data
      const { count: sentenceCount } = await supabase
        .from('vocab_master')
        .select('*', { count: 'exact' })
        .eq('category', cat)
        .not('sentence_english', 'is', null);

      // Get learned count for this category
      const { count: learnedCount } = await supabase
        .from('user_vocab_progress')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .in('vocab_id', vocabIds)
        .gt('fluency', 0);

      return { 
        category: cat, 
        count, 
        learnedCount: learnedCount || 0, 
        subcategoryCount: maxSubcategory,
        hasSentences: (sentenceCount || 0) > 0
      };
    });

    const categoryStats = await Promise.all(categoryStatsPromises);

    const categoryIcons: { [key: string]: string } = {
      'Emotion': '😊',
      'Family': '👨‍👩‍👧‍👦',
      'Food': '🍕',
      'Action': '🏃',
      'Nature': '🌳',
      'Animal': '🐶',
      'Color': '🎨',
      'Body': '👤',
      'Time': '⏰',
      'Place': '🏠',
      'Object': '📦',
    };

    const formattedCategories = categoryStats.map(stat => ({
      name: stat.category,
      count: stat.count,
      learned_count: stat.learnedCount,
      subcategoryCount: stat.subcategoryCount,
      hasSentences: stat.hasSentences,
      icon: categoryIcons[stat.category] || '📚',
    }));

    return NextResponse.json({
      success: true,
      categories: formattedCategories,
    });

  } catch (error) {
    console.error('Error in categories API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
