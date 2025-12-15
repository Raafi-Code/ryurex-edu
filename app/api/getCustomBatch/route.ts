import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const isPvP = searchParams.get('isPvP') === 'true'; // New parameter for PvP mode

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

    const subcategoryInt = parseInt(subcategory);
    console.log('🎮 Custom Batch Request:', {
      userId: user.id,
      category,
      subcategory: subcategoryInt,
      isPvP,
    });

    // Get all words from the specified category and subcategory
    // No "due today" filter - just fetch all words for custom learning mode
    let query = supabase
      .from('vocab_master')
      .select('id, indo, english, class, category, subcategory')
      .eq('category', category);
    
    // If subcategory is 0 (Random mode), fetch from all subcategories
    // Otherwise, fetch from specific subcategory
    if (subcategoryInt !== 0) {
      query = query.eq('subcategory', subcategoryInt);
    }
    
    const { data: allWords, error: fetchError } = await query.order('id');

    if (fetchError) {
      console.error('Error fetching words:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary words' },
        { status: 500 }
      );
    }

    if (!allWords || allWords.length === 0) {
      console.log('⚠️ No words found for:', { category, subcategory: subcategoryInt });
      return NextResponse.json({
        success: true,
        words: [],
        count: 0,
        message: 'No words available for this category and subcategory'
      });
    }

    console.log(`✅ Found ${allWords.length} words in ${category} Part ${subcategory}`);

    // Get user's progress for these words (to show if they've learned them before)
    const wordIds = allWords.map(w => w.id);
    const { data: progressData } = await supabase
      .from('user_vocab_progress')
      .select('vocab_id, ease_factor, interval_days, repetitions, last_review')
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
    const newWords: Array<{ id: number; indo: string; english: string; class: string; category: string; subcategory: number }> = [];
    const reviewWords: Array<{ id: number; indo: string; english: string; class: string; category: string; subcategory: number }> = [];

    allWords.forEach(word => {
      const progress = progressMap.get(word.id);
      if (!progress || progress.repetitions === 0) {
        newWords.push(word);
      } else {
        reviewWords.push(word);
      }
    });

    console.log(`📊 Word Distribution: ${newWords.length} new, ${reviewWords.length} review`);

    // Initialize progress for NEW words (words user hasn't seen before)
    if (newWords.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const newProgressEntries = newWords.map((word: { id: number }) => ({
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
        // Ignore duplicate key errors (word already exists in progress)
        if (!insertError.message.includes('duplicate key')) {
          console.error('❌ Error inserting new progress:', insertError);
        }
      } else {
        console.log(`✅ Initialized progress for ${newWords.length} new words`);
        console.log(`   - Words WITH sentence: fluency_sentence=0, next_due_sentence=today`);
        console.log(`   - Words WITHOUT sentence: fluency_sentence=NULL, next_due_sentence=NULL`);
      }
    }

    // Mix new and review words
    // Strategy: Start with some review words (if available), then new words
    let selectedWords: Array<{ id: number; indo: string; english: string; class: string; category: string; subcategory: number }> = [];
    
    // Check if this is Random mode (subcategory === 0) for PvP
    const isRandomMode = subcategoryInt === 0;
    
    if (isRandomMode && isPvP) {
      // For Random PvP mode, we'll use all words
      // Just return all available words (game will limit based on num_questions)
      selectedWords = allWords;
      console.log(`🎲 Random Mode PvP: Using all ${allWords.length} words from category`);
    } else if (reviewWords.length > 0 && newWords.length > 0) {
      // Mix: 40% review, 60% new (or whatever is available)
      const reviewCount = Math.min(4, reviewWords.length);
      const newCount = Math.min(6, newWords.length);
      
      selectedWords = [
        ...reviewWords.slice(0, reviewCount),
        ...newWords.slice(0, newCount)
      ];
    } else if (newWords.length > 0) {
      // Only new words available
      selectedWords = newWords.slice(0, 10);
    } else {
      // Only review words available
      selectedWords = reviewWords.slice(0, 10);
    }

    // Words sudah diambil sesuai kebutuhan, langsung pakai tanpa shuffle
    // Tidak perlu randomize lagi setelah fetch

    console.log(`🎯 Selected ${selectedWords.length} words for practice`);

    // Get updated progress data for selected words (after inserting new ones)
    const selectedWordIds = selectedWords.map(w => w.id);
    const { data: updatedProgress } = await supabase
      .from('user_vocab_progress')
      .select('vocab_id, fluency, next_due')
      .eq('user_id', user.id)
      .in('vocab_id', selectedWordIds);

    // Create progress map
    const updatedProgressMap = new Map();
    if (updatedProgress) {
      updatedProgress.forEach(p => {
        updatedProgressMap.set(p.vocab_id, p);
      });
    }

    // Format response with progress data
    const formattedWords = selectedWords.map((word: { id: number; indo: string; english: string; class: string; category: string; subcategory: number }) => {
      const progress = updatedProgressMap.get(word.id);
      return {
        vocab_id: word.id,
        indo: word.indo,
        english: word.english,
        class: word.class,
        category: word.category,
        subcategory: word.subcategory,
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
      subcategory: parseInt(subcategory)
    });

  } catch (error) {
    console.error('Custom batch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
