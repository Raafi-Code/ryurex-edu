import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let groqClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function initializeGroq(): Promise<any> {
  if (!groqClient) {
    try {
      const Groq = (await import('groq-sdk')).default;
      groqClient = new Groq({
        apiKey: process.env.GROQ_API_KEY,
      });
    } catch (error) {
      console.error('Failed to initialize Groq:', error);
      throw new Error('Groq SDK not available. Please install groq-sdk package.');
    }
  }
  return groqClient;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Validate authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Rate limiting: 5 requests per minute per user for Groq API
    const rateLimitResult = checkRateLimit(`ai-generate-${user.id}`, RATE_LIMITS.GROQ_API);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          success: false,
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

    const { category, subcategory } = await req.json();

    if (!category || subcategory === undefined) {
      return NextResponse.json(
        { error: 'Category and subcategory are required', success: false },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY not configured', success: false },
        { status: 500 }
      );
    }

    // 1. Fetch all Indonesian words from the category/subcategory via mapping table
    // Get category id
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (catError || !catData) {
      console.error('Category not found:', catError);
      return NextResponse.json(
        { error: 'Category not found', success: false },
        { status: 404 }
      );
    }

    // Get vocab IDs from mapping for this subcategory
    const { data: mappingData, error: mappingError } = await supabase
      .from('vocab_category_mapping')
      .select('vocab_id')
      .eq('category_id', catData.id)
      .eq('subcategory_name', subcategory);

    if (mappingError || !mappingData || mappingData.length === 0) {
      console.error('No mappings found:', mappingError);
      return NextResponse.json(
        { error: 'No vocabulary found for this category/subcategory', success: false },
        { status: 404 }
      );
    }

    const vocabIds = mappingData.map(m => m.vocab_id);

    // Fetch vocab data
    const { data: vocabWords, error: fetchError } = await supabase
      .from('vocab_master')
      .select('id, indo, english_primary, synonyms, class')
      .in('id', vocabIds)
      .order('id');

    if (fetchError) {
      console.error('Error fetching vocab:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch vocabulary', success: false },
        { status: 500 }
      );
    }

    if (!vocabWords || vocabWords.length === 0) {
      return NextResponse.json(
        { error: 'No vocabulary found for this category/subcategory', success: false },
        { status: 404 }
      );
    }

    console.log(`📚 Fetched ${vocabWords.length} words for AI sentence generation`);

    // 2. Try to generate Indonesian sentences using Groq
    let generatedSentences: Array<{ word: string; sentence_indo: string; sentence_english: string }> = [];
    let usedFallback = false;

    try {
      const groq = await initializeGroq();

      const indonesianWords = vocabWords.map(w => `"${w.indo}"`).join(', ');
      
      // Add randomization to ensure unique prompts and prevent caching
      const randomSeed = Math.random().toString(36).substring(7);
      const contextVariety = ['daily life', 'work/school', 'social situations', 'creative scenarios', 'practical uses', 'travel contexts'];
      const randomContext = contextVariety[Math.floor(Math.random() * contextVariety.length)];
      
      const prompt = `Generate one UNIQUE and VARIED natural Indonesian sentence for each of the following words, along with its accurate English translation. Focus on ${randomContext} contexts. For each word:
1. Create a natural Indonesian sentence using the word in context
2. Provide an accurate English translation of that sentence
3. The sentence should be appropriate for language learners (simple, clear, and educational)
4. Be grammatically correct in both languages
5. Be 5-15 words long
6. Show diverse contexts and scenarios (not similar sentences)
7. Be DIFFERENT from any previously generated sentences
8. Be creative and engaging

Words: ${indonesianWords}

[Seed: ${randomSeed}]

Return ONLY a JSON array with this exact structure, no other text, no markdown code blocks:
[
  {"word": "word1", "sentence_indo": "sentence in Indonesian", "sentence_english": "English translation"},
  {"word": "word2", "sentence_indo": "sentence in Indonesian", "sentence_english": "English translation"},
  ...
]`;

      console.log('🤖 Calling Groq API for sentence generation...');

      const groqResponse = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 1.0,
        top_p: 0.95,
        max_tokens: 2000,
      });

      const generatedContent = groqResponse.choices[0]?.message?.content || '';
      console.log('📝 Groq response received');

      // Parse the JSON response
      try {
        // Extract JSON from response (it might contain extra text)
        const jsonMatch = generatedContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          generatedSentences = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        console.error('Failed to parse Groq response:', parseError);
        console.error('Raw response:', generatedContent);
        throw new Error('Failed to parse AI-generated sentences');
      }
    } catch (groqError) {
      console.warn('⚠️ Groq API failed, attempting fallback from database...', groqError);
      
      // 2b. Fallback: Try to fetch sentences from sentence_blanks table
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('sentence_blanks')
          .select('vocab_id, sentence_indo, sentence_english')
          .in('vocab_id', vocabIds)
          .limit(vocabIds.length);

        if (!fallbackError && fallbackData && fallbackData.length > 0) {
          console.log(`📚 Found ${fallbackData.length} fallback sentences from database`);
          
          // Map fallback sentences to the expected format
          const fallbackMap = new Map<number, { sentence_indo: string; sentence_english: string }>();
          fallbackData.forEach((item: any) => {
            if (!fallbackMap.has(item.vocab_id)) {
              fallbackMap.set(item.vocab_id, {
                sentence_indo: item.sentence_indo,
                sentence_english: item.sentence_english,
              });
            }
          });

          // Convert fallback map to generatedSentences format
          generatedSentences = vocabWords
            .filter(vocab => fallbackMap.has(vocab.id))
            .map(vocab => {
              const fallback = fallbackMap.get(vocab.id)!;
              return {
                word: vocab.indo,
                sentence_indo: fallback.sentence_indo,
                sentence_english: fallback.sentence_english,
              };
            });

          usedFallback = true;
          
          if (generatedSentences.length > 0) {
            console.log(`✅ Successfully retrieved ${generatedSentences.length} fallback sentences from database`);
          }
        } else {
          console.warn('⚠️ No fallback sentences found in database');
        }
      } catch (fallbackError) {
        console.error('❌ Fallback query also failed:', fallbackError);
      }

      // 2c. If still no sentences, use simple auto-generated fallback
      if (generatedSentences.length === 0) {
        console.log('⚠️ Creating auto-generated fallback sentences...');
        generatedSentences = vocabWords.map(vocab => ({
          word: vocab.indo,
          sentence_indo: `${vocab.indo} adalah kata yang penting untuk dipelajari.`,
          sentence_english: `"${vocab.english_primary}" is an important word to learn.`,
        }));
        usedFallback = true;
      }
    }

    // 3. Create a map of generated sentences (remove trailing dots)
    const sentenceMapIndo = new Map<string, string>();
    const sentenceMapEnglish = new Map<string, string>();
    generatedSentences.forEach(item => {
      const cleanedSentenceIndo = item.sentence_indo.trim().replace(/\.$/, ''); // Remove trailing dot
      const cleanedSentenceEnglish = item.sentence_english.trim().replace(/\.$/, ''); // Remove trailing dot
      const normalizedWord = item.word.toLowerCase().trim();
      sentenceMapIndo.set(normalizedWord, cleanedSentenceIndo);
      sentenceMapEnglish.set(normalizedWord, cleanedSentenceEnglish);
    });

    if (usedFallback) {
      console.log(`🔄 Using fallback sentences (${generatedSentences.length} sentences)`);
    } else {
      console.log('📊 Generated sentences map:');
      sentenceMapIndo.forEach((sentence, word) => {
        console.log(`  ${word}: ${sentence.substring(0, 50)}...`);
      });
    }

    // 4. Build result with both Indonesian and English sentences
    const vocabWithAiSentences = vocabWords.map((vocab, idx) => {
      const normalizedVocab = vocab.indo.toLowerCase().trim();
      const sentenceIndo = sentenceMapIndo.get(normalizedVocab);
      const sentenceEnglish = sentenceMapEnglish.get(normalizedVocab);
      
      if (!sentenceIndo || !sentenceEnglish) {
        console.warn(`⚠️ Missing sentence for vocab "${vocab.indo}" (normalized: "${normalizedVocab}") at index ${idx}`);
      }

      return {
        id: vocab.id,
        vocab_id: vocab.id,
        indo: vocab.indo,
        english_primary: vocab.english_primary,
        synonyms: vocab.synonyms || [],
        class: vocab.class,
        category: category,
        subcategory: subcategory,
        sentence_indo: sentenceIndo || `${vocab.indo} adalah...`,
        sentence_english: sentenceEnglish || `This is a ${vocab.english_primary}...`,
      };
    });

    const logMessage = usedFallback 
      ? `✅ Generated ${vocabWithAiSentences.length} sentences (using database fallback)`
      : `✅ Generated ${vocabWithAiSentences.length} AI sentences (Indonesian + English)`;
    console.log(logMessage);

    return NextResponse.json({
      success: true,
      words: vocabWithAiSentences,
      count: vocabWithAiSentences.length,
      usedFallback: usedFallback,
    });
  } catch (error) {
    console.error('❌ Error in generateSentences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If we reach here, something went seriously wrong
    // Return a 500 error only if we couldn't recover with fallback
    return NextResponse.json(
      { error: `Failed to generate sentences: ${errorMessage}`, success: false },
      { status: 500 }
    );
  }
}
