import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory'); // Now a topic name string
    const isPvP = searchParams.get('isPvP') === 'true';

    // Validate required parameters
    if (!category || !subcategory) {
      return NextResponse.json(
        { error: 'Category and subcategory are required' },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(`getCustomBatch-${user.id}`, RATE_LIMITS.LENIENT);
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

    console.log('🎮 Custom Batch Request:', {
      userId: user.id,
      category,
      subcategory,
      isPvP,
    });

    // Get category ID from categories table
    const { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (categoryError || !categoryData) {
      console.error('Category not found:', category);
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get vocab IDs from mapping table for this category + subcategory_name
    let mappingQuery = supabase
      .from('vocab_category_mapping')
      .select('vocab_id')
      .eq('category_id', categoryData.id);

    // If subcategory is "0" or "random", fetch from all subcategories (Random mode)
    const isRandomMode = subcategory === '0' || subcategory.toLowerCase() === 'random';
    if (!isRandomMode) {
      mappingQuery = mappingQuery.eq('subcategory_name', subcategory);
    }

    const { data: mappingData, error: mappingError } = await mappingQuery;

    if (mappingError) {
      console.error('Error fetching mapping:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary words' },
        { status: 500 }
      );
    }

    const vocabIds = mappingData?.map(m => m.vocab_id) || [];

    if (vocabIds.length === 0) {
      console.log('⚠️ No words found for:', { category, subcategory });
      return NextResponse.json({
        success: true,
        words: [],
        count: 0,
        message: 'No words available for this category and subcategory'
      });
    }

    // Fetch all vocab words for these IDs — return ALL words (no 10-word limit)
    const { data: allWords, error: fetchError } = await supabase
      .from('vocab_master')
      .select('id, indo, english_primary, synonyms, class')
      .in('id', vocabIds)
      .order('id');

    if (fetchError) {
      console.error('Error fetching words:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary words' },
        { status: 500 }
      );
    }

    if (!allWords || allWords.length === 0) {
      console.log('⚠️ No vocab_master entries found for IDs:', vocabIds);
      return NextResponse.json({
        success: true,
        words: [],
        count: 0,
        message: 'No words available for this category and subcategory'
      });
    }

    console.log(`✅ Found ${allWords.length} words in ${category} / ${subcategory}`);

    // Get user's progress for these words
    const wordIds = allWords.map(w => w.id);
    const { data: progressData } = await supabase
      .from('user_vocab_progress')
      .select('vocab_id, fluency, correct_count')
      .eq('user_id', user.id)
      .in('vocab_id', wordIds);

    // Create a map of progress data
    const progressMap = new Map();
    if (progressData) {
      progressData.forEach(p => {
        progressMap.set(p.vocab_id, p);
      });
    }

    // Separate words into new and review categories
    const newWords: typeof allWords = [];
    const reviewWords: typeof allWords = [];

    allWords.forEach(word => {
      const progress = progressMap.get(word.id);
      if (!progress || progress.correct_count === 0) {
        newWords.push(word);
      } else {
        reviewWords.push(word);
      }
    });

    console.log(`📊 Word Distribution: ${newWords.length} new, ${reviewWords.length} review`);

    // Initialize progress for NEW words (words user hasn't seen before)
    if (newWords.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const newProgressEntries = newWords.map((word) => ({
        user_id: user.id,
        vocab_id: word.id,
        fluency: 0,
        next_due: todayStr,
        response_avg: 0,
        correct_count: 0,
        wrong_count: 0,
      }));

      const { error: insertError } = await supabase
        .from('user_vocab_progress')
        .insert(newProgressEntries)
        .select();

      if (insertError) {
        if (!insertError.message.includes('duplicate key')) {
          console.error('❌ Error inserting new progress:', insertError);
        }
      } else {
        console.log(`✅ Initialized progress for ${newWords.length} new words`);
      }
    }

    // Return ALL words for the topic — no 10-word slice limit
    // For Random PvP mode, return all words for the category
    let selectedWords: typeof allWords;
    
    if (isRandomMode && isPvP) {
      selectedWords = allWords;
      console.log(`🎲 Random Mode PvP: Using all ${allWords.length} words from category`);
    } else {
      // Return ALL words for the subcategory topic (dynamic subcategory, no fixed limit)
      selectedWords = allWords;
    }

    console.log(`🎯 Selected ${selectedWords.length} words for practice`);

    // Get updated progress data for selected words
    const selectedWordIds = selectedWords.map(w => w.id);
    const { data: updatedProgress } = await supabase
      .from('user_vocab_progress')
      .select('vocab_id, fluency, next_due')
      .eq('user_id', user.id)
      .in('vocab_id', selectedWordIds);

    const updatedProgressMap = new Map();
    if (updatedProgress) {
      updatedProgress.forEach(p => {
        updatedProgressMap.set(p.vocab_id, p);
      });
    }

    // Format response with english_primary + synonyms
    const formattedWords = selectedWords.map((word) => {
      const progress = updatedProgressMap.get(word.id);
      return {
        vocab_id: word.id,
        indo: word.indo,
        english_primary: word.english_primary,
        synonyms: word.synonyms || [],
        class: word.class,
        category: category,
        subcategory: subcategory,
        fluency: progress?.fluency || 0,
        next_due: progress?.next_due || new Date().toISOString().split('T')[0],
      };
    });

    return NextResponse.json({
      success: true,
      words: formattedWords,
      count: formattedWords.length,
      total_available: allWords.length,
      category,
      subcategory,
    });

  } catch (error) {
    console.error('Custom batch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
