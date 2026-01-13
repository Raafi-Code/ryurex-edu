import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get category and subcategory from query params
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');
    const subcategoryFilter = searchParams.get('subcategory');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user exists in public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    console.log('=== VOCAB BATCH DEBUG ===');
    console.log(`📅 Today's date: ${today}`);

    // Step 1: Get ALL progress records due today (NO limit yet)
    const progressQuery = supabase
      .from('user_vocab_progress')
      .select('vocab_id, fluency, next_due')
      .eq('user_id', user.id)
      .lte('next_due', today)
      .order('next_due', { ascending: true })
      .order('fluency', { ascending: true });

    const { data: progressWords, error: progressError } = await progressQuery;

    if (progressError) {
      console.error('❌ Error fetching progress words:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary' },
        { status: 500 }
      );
    }

    if (!progressWords || progressWords.length === 0) {
      console.log('✅ No words due for review today');
      return NextResponse.json({
        success: true,
        words: [],
        count: 0,
      });
    }

    const vocabIds = progressWords.map(p => p.vocab_id);
    console.log(`✅ Found ${vocabIds.length} words due for review today`);

    // Step 2: Get vocab_master data for these IDs (fast - indexed query)
    let vocabQuery = supabase
      .from('vocab_master')
      .select('id, indo, english, class, category, subcategory')
      .in('id', vocabIds);

    // Apply filters if provided
    if (categoryFilter) {
      console.log(`🎯 Filtering by category: ${categoryFilter}`);
      vocabQuery = vocabQuery.eq('category', categoryFilter);
    }

    if (subcategoryFilter) {
      console.log(`📊 Filtering by subcategory: ${subcategoryFilter}`);
      vocabQuery = vocabQuery.eq('subcategory', parseInt(subcategoryFilter));
    }

    const { data: vocabData, error: vocabError } = await vocabQuery;

    if (vocabError) {
      console.error('❌ Error fetching vocab data:', vocabError);
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary' },
        { status: 500 }
      );
    }

    // Step 3: Create lookup maps for O(1) merge
    const vocabMap = new Map(vocabData?.map(v => [v.id, v]) || []);
    const progressMap = new Map(progressWords.map(p => [p.vocab_id, p]) || []);

    // Step 4: Merge data in memory (skip filtered-out vocab)
    const allWords = vocabIds
      .map(vocabId => {
        const vocab = vocabMap.get(vocabId);
        const progress = progressMap.get(vocabId);
        if (!vocab) return null; // Skip if vocab was filtered out
        
        return {
          vocab_id: vocab.id,
          indo: vocab.indo,
          english: vocab.english,
          class: vocab.class,
          category: vocab.category,
          subcategory: vocab.subcategory,
          fluency: progress?.fluency || 0,
          next_due: progress?.next_due || today,
        };
      })
      .filter(Boolean);

    // Step 5: Apply limit AFTER all filtering
    const words = allWords.slice(0, 10);

    console.log(`📊 Final batch: ${words.length} words (after filters and limit)`);

    return NextResponse.json({
      success: true,
      words,
      count: words.length,
    });

  } catch (error: Error | unknown) {
    console.error('Error fetching batch:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
