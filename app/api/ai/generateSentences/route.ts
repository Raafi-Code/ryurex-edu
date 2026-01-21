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

    // 1. Fetch all Indonesian words from the category/subcategory
    const { data: vocabWords, error: fetchError } = await supabase
      .from('vocab_master')
      .select('id, indo, english, class, category, subcategory')
      .eq('category', category)
      .eq('subcategory', parseInt(subcategory))
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

    // 2. Generate Indonesian sentences using Groq
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
    let generatedSentences: Array<{ word: string; sentence_indo: string; sentence_english: string }> = [];
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
      return NextResponse.json(
        { error: 'Failed to parse AI-generated sentences', success: false },
        { status: 500 }
      );
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

    console.log('📊 Generated sentences map:');
    sentenceMapIndo.forEach((sentence, word) => {
      console.log(`  ${word}: ${sentence.substring(0, 50)}...`);
    });

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
        english: vocab.english,
        class: vocab.class,
        category: vocab.category,
        subcategory: vocab.subcategory,
        sentence_indo: sentenceIndo || `${vocab.indo} adalah...`,
        sentence_english: sentenceEnglish || `This is a ${vocab.english}...`,
      };
    });

    console.log(`✅ Generated ${vocabWithAiSentences.length} AI sentences (Indonesian + English)`);

    return NextResponse.json({
      success: true,
      words: vocabWithAiSentences,
      count: vocabWithAiSentences.length,
    });
  } catch (error) {
    console.error('❌ Error in generateSentences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to generate sentences: ${errorMessage}`, success: false },
      { status: 500 }
    );
  }
}
