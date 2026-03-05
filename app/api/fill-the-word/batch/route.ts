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

interface VocabWord {
  id: number;
  indo: string;
  english_primary: string;
  synonyms: string[] | null;
  class: string | null;
}

interface SentenceBlank {
  id: number;
  vocab_id: number;
  sentence_indo: string;
  sentence_english: string;
  blank_answer: string;
  explanation: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');

    // Validate required parameters
    if (!category || !subcategory) {
      return NextResponse.json(
        { error: 'Category and subcategory are required', success: false },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', success: false },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = checkRateLimit(`fill-the-word-${user.id}`, RATE_LIMITS.LENIENT);
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

    // 1. Get category ID
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', category)
      .single();

    if (catError || !catData) {
      return NextResponse.json(
        { error: 'Category not found', success: false },
        { status: 404 }
      );
    }

    // 2. Get vocab IDs from mapping
    const isRandomMode = subcategory === '0' || subcategory.toLowerCase() === 'random';
    let mappingQuery = supabase
      .from('vocab_category_mapping')
      .select('vocab_id')
      .eq('category_id', catData.id);

    if (!isRandomMode) {
      mappingQuery = mappingQuery.eq('subcategory_name', subcategory);
    }

    const { data: mappingData, error: mappingError } = await mappingQuery;

    if (mappingError || !mappingData || mappingData.length === 0) {
      return NextResponse.json(
        { error: 'No vocabulary found for this category/subcategory', success: false },
        { status: 404 }
      );
    }

    const vocabIds = mappingData.map(m => m.vocab_id);

    // 3. Fetch vocab words
    const { data: vocabWords, error: fetchError } = await supabase
      .from('vocab_master')
      .select('id, indo, english_primary, synonyms, class')
      .in('id', vocabIds)
      .order('id');

    if (fetchError || !vocabWords || vocabWords.length === 0) {
      return NextResponse.json(
        { error: 'No vocabulary found', success: false },
        { status: 404 }
      );
    }

    // 4. Check which vocab already have sentences in sentence_blanks
    const { data: existingSentences, error: sentenceError } = await supabase
      .from('sentence_blanks')
      .select('id, vocab_id, sentence_indo, sentence_english, blank_answer, explanation')
      .in('vocab_id', vocabIds);

    if (sentenceError) {
      console.error('Error fetching existing sentences:', sentenceError);
    }

    // Build map of existing sentences (one per vocab_id, pick first)
    const sentenceMap = new Map<number, SentenceBlank>();
    if (existingSentences) {
      existingSentences.forEach(s => {
        if (!sentenceMap.has(s.vocab_id)) {
          sentenceMap.set(s.vocab_id, s);
        }
      });
    }

    // 5. Find vocab that need sentence generation
    const vocabWithSentences: VocabWord[] = [];
    const vocabWithoutSentences: VocabWord[] = [];

    vocabWords.forEach(v => {
      if (sentenceMap.has(v.id)) {
        vocabWithSentences.push(v);
      } else {
        vocabWithoutSentences.push(v);
      }
    });

    console.log(`📚 Fill the Word: ${vocabWithSentences.length} cached, ${vocabWithoutSentences.length} need generation`);

    // 6. Generate sentences for vocab that don't have them yet
    if (vocabWithoutSentences.length > 0) {
      if (!process.env.GROQ_API_KEY) {
        return NextResponse.json(
          { error: 'GROQ_API_KEY not configured. Cannot generate sentences.', success: false },
          { status: 500 }
        );
      }

      // Rate limit AI generation separately
      const aiRateLimit = checkRateLimit(`fill-the-word-ai-${user.id}`, RATE_LIMITS.GROQ_API);
      if (!aiRateLimit.allowed) {
        // If AI rate limited but we have some cached sentences, return those
        if (vocabWithSentences.length > 0) {
          console.log('⚠️ AI rate limited, returning cached sentences only');
        } else {
          return NextResponse.json(
            {
              error: 'AI generation rate limited. Please try again later.',
              success: false,
              retryAfter: Math.ceil((aiRateLimit.resetTime - Date.now()) / 1000),
            },
            { status: 429 }
          );
        }
      } else {
        // Generate sentences via Groq
        try {
          const generatedSentences = await generateSentencesForVocab(vocabWithoutSentences);

          // Insert generated sentences into DB
          if (generatedSentences.length > 0) {
            const insertData = generatedSentences.map(s => ({
              vocab_id: s.vocab_id,
              sentence_indo: s.sentence_indo,
              sentence_english: s.sentence_english,
              blank_answer: s.blank_answer,
              explanation: s.explanation || null,
              source: 'ai',
            }));

            const { data: insertedData, error: insertError } = await supabase
              .from('sentence_blanks')
              .insert(insertData)
              .select();

            if (insertError) {
              // Handle duplicate key gracefully
              if (!insertError.message.includes('duplicate key')) {
                console.error('❌ Error inserting sentences:', insertError);
              }
            } else if (insertedData) {
              console.log(`✅ Inserted ${insertedData.length} new sentences into DB`);
              // Add to sentence map
              insertedData.forEach(s => {
                sentenceMap.set(s.vocab_id, s);
              });
            }
          }
        } catch (aiError) {
          console.error('❌ AI generation failed:', aiError);
          // If we have some cached sentences, continue with those
          if (vocabWithSentences.length === 0) {
            return NextResponse.json(
              { error: 'Failed to generate sentences. Please try again.', success: false },
              { status: 500 }
            );
          }
        }
      }
    }

    // 7. Initialize user_vocab_progress for new words (same logic as getCustomBatch)
    const wordIds = vocabWords.map(w => w.id);
    const { data: progressData } = await supabase
      .from('user_vocab_progress')
      .select('vocab_id, fluency, correct_count, next_due')
      .eq('user_id', user.id)
      .in('vocab_id', wordIds);

    const progressMap = new Map<number, { fluency: number; correct_count: number; next_due: string }>();
    if (progressData) {
      progressData.forEach(p => {
        progressMap.set(p.vocab_id, p);
      });
    }

    // Find new words needing progress initialization
    const newWordIds = wordIds.filter(id => {
      const p = progressMap.get(id);
      return !p || p.correct_count === 0;
    });

    if (newWordIds.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const newProgressEntries = newWordIds.map(vocabId => ({
        user_id: user.id,
        vocab_id: vocabId,
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

      if (insertError && !insertError.message.includes('duplicate key')) {
        console.error('❌ Error inserting progress:', insertError);
      }
    }

    // 8. Build final response — only include vocab that have sentences
    const formattedWords = vocabWords
      .filter(v => sentenceMap.has(v.id))
      .map(v => {
        const sentence = sentenceMap.get(v.id)!;
        const progress = progressMap.get(v.id);
        return {
          vocab_id: v.id,
          indo: v.indo,
          english_primary: v.english_primary,
          synonyms: v.synonyms || [],
          class: v.class || '',
          category,
          subcategory,
          fluency: progress?.fluency || 0,
          sentence_indo: sentence.sentence_indo,
          sentence_english: sentence.sentence_english,
          blank_answer: sentence.blank_answer,
          explanation: sentence.explanation || null,
        };
      });

    console.log(`✅ Returning ${formattedWords.length} words with sentences for Fill the Word`);

    return NextResponse.json({
      success: true,
      words: formattedWords,
      count: formattedWords.length,
      total_available: vocabWords.length,
      category,
      subcategory,
    });

  } catch (error) {
    console.error('❌ Fill the Word batch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 }
    );
  }
}

// ============================================
// AI Sentence Generation Helper
// ============================================
async function generateSentencesForVocab(
  vocabWords: VocabWord[]
): Promise<Array<{ vocab_id: number; sentence_indo: string; sentence_english: string; blank_answer: string; explanation: string }>> {
  const groq = await initializeGroq();

  // Build word list with English translations and word class for context
  const wordList = vocabWords.map(w =>
    `"${w.indo}" (English: "${w.english_primary}", class: ${w.class || 'unknown'})`
  ).join(', ');

  const randomSeed = Math.random().toString(36).substring(7);
  const contextVariety = ['daily life', 'work/school', 'social situations', 'creative scenarios', 'practical uses', 'travel contexts'];
  const randomContext = contextVariety[Math.floor(Math.random() * contextVariety.length)];

  const prompt = `Generate one UNIQUE and VARIED natural Indonesian sentence for each of the following words, along with its accurate English translation. Focus on ${randomContext} contexts.

For each word:
1. Create a natural Indonesian sentence using the Indonesian word in context
2. Provide an accurate English translation of that sentence
3. The "blank_answer" is the EXACT English form of the target word AS IT APPEARS in sentence_english. It may be conjugated or modified based on grammar (e.g., "run" → "runs", "running", "ran"; "book" → "books"). The blank_answer MUST appear EXACTLY ONCE in sentence_english.
4. The "explanation" is a DETAILED grammar explanation of WHY the blank_answer takes that specific form. It should:
   - Identify the grammatical rule or pattern being applied
   - Explain the WHY (subject, tense, person, etc.)
   - Show the transformation (base form → modified form)
   - Be educational and clear for English learners
   
   Examples of GOOD explanations:
   - "Subject 'she' is third-person singular. In Simple Present Tense, third-person singular verbs must end with -s or -es. Therefore, 'love' becomes 'loves'."
   - "The sentence is in Simple Present Tense with subject 'they' (third-person plural), so the base form 'run' is used without any suffix."
   - "The sentence uses 'is' (present continuous), so the verb must take the -ing form. Therefore, 'read' becomes 'reading'."
   - "The word is used in a plural context, so the noun form takes -s or -es. Therefore, 'book' becomes 'books'."
   - "Past tense requires the past form. The base 'go' becomes 'went' in Simple Past Tense."
   
   ALWAYS follow this structure:
   - State the SUBJECT or CONTEXT
   - Name the GRAMMATICAL RULE (e.g., "Simple Present Tense", "Third-person singular", "Plural noun", "Past Tense")
   - Explain the TRANSFORMATION (base → result and why)

5. Sentences should be 5-15 words long, simple, clear, and educational
6. Be grammatically correct in both languages
7. Show diverse contexts (not similar sentences)
8. Be creative and engaging

Words: ${wordList}

[Seed: ${randomSeed}]

Return ONLY a JSON array with this exact structure, no other text, no markdown code blocks:
[
  {"word": "indonesian_word", "english": "base_english_word", "sentence_indo": "sentence in Indonesian", "sentence_english": "English translation", "blank_answer": "exact_english_word_form_in_sentence", "explanation": "detailed grammar explanation"},
  ...
]`;

  console.log('🤖 Calling Groq API for Fill the Word sentence generation...');

  const groqResponse = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    temperature: 1.0,
    top_p: 0.95,
    max_tokens: 8000,
  });

  const generatedContent = groqResponse.choices[0]?.message?.content || '';
  console.log('📝 Groq response received for Fill the Word');

  // Parse JSON response
  let generatedSentences: Array<{
    word: string;
    english?: string;
    sentence_indo: string;
    sentence_english: string;
    blank_answer: string;
    explanation?: string;
  }> = [];

  try {
    const jsonMatch = generatedContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      generatedSentences = JSON.parse(jsonMatch[0]);
    } else {
      // Attempt to recover truncated JSON array (e.g. max_tokens cut-off)
      const arrayStart = generatedContent.indexOf('[');
      if (arrayStart !== -1) {
        let truncated = generatedContent.slice(arrayStart);
        // Find the last complete object (ending with })
        const lastCloseBrace = truncated.lastIndexOf('}');
        if (lastCloseBrace !== -1) {
          truncated = truncated.slice(0, lastCloseBrace + 1) + ']';
          try {
            generatedSentences = JSON.parse(truncated);
            console.warn(`⚠️ Recovered ${generatedSentences.length} items from truncated AI response`);
          } catch {
            throw new Error('No valid JSON array found in response (recovery failed)');
          }
        } else {
          throw new Error('No JSON array found in response');
        }
      } else {
        throw new Error('No JSON array found in response');
      }
    }
  } catch (parseError) {
    console.error('Failed to parse Groq response:', parseError);
    console.error('Raw response:', generatedContent);
    throw new Error('Failed to parse AI-generated sentences');
  }

  // Map generated sentences back to vocab and validate
  const results: Array<{ vocab_id: number; sentence_indo: string; sentence_english: string; blank_answer: string; explanation: string }> = [];

  for (const item of generatedSentences) {
    const normalizedWord = item.word?.toLowerCase().trim();
    if (!normalizedWord) continue;

    // Find matching vocab
    const vocab = vocabWords.find(v => v.indo.toLowerCase().trim() === normalizedWord);
    if (!vocab) {
      console.warn(`⚠️ No vocab match for generated word "${item.word}"`);
      continue;
    }

    let blankAnswer = (item.blank_answer || '').trim().replace(/\.$/, '');
    const sentenceEnglish = (item.sentence_english || '').trim().replace(/\.$/, '');
    const sentenceIndo = (item.sentence_indo || '').trim().replace(/\.$/, '');

    if (!sentenceEnglish || !sentenceIndo || !blankAnswer) {
      console.warn(`⚠️ Incomplete sentence data for "${item.word}"`);
      continue;
    }

    // Validate that blank_answer actually appears in sentence_english (case-insensitive word match)
    const blankRegex = new RegExp(`\\b${escapeRegExp(blankAnswer)}\\b`, 'i');
    if (!blankRegex.test(sentenceEnglish)) {
      // Fallback: try english_primary
      const primaryRegex = new RegExp(`\\b${escapeRegExp(vocab.english_primary)}\\b`, 'i');
      if (primaryRegex.test(sentenceEnglish)) {
        // Find the exact form in the sentence
        const match = sentenceEnglish.match(primaryRegex);
        if (match) {
          blankAnswer = match[0];
          console.log(`🔄 Corrected blank_answer for "${vocab.indo}": "${item.blank_answer}" → "${blankAnswer}"`);
        }
      } else {
        // Try to find any form of the word in the sentence
        const words = sentenceEnglish.split(/\s+/);
        const baseWord = vocab.english_primary.toLowerCase();
        const found = words.find(w => {
          const cleanW = w.replace(/[.,!?;:'"()-]/g, '').toLowerCase();
          return cleanW.startsWith(baseWord.slice(0, Math.max(3, baseWord.length - 2)));
        });
        if (found) {
          blankAnswer = found.replace(/[.,!?;:'"()-]$/g, '');
          console.log(`🔄 Fuzzy matched blank_answer for "${vocab.indo}": "${blankAnswer}"`);
        } else {
          console.warn(`⚠️ blank_answer "${blankAnswer}" not found in sentence for "${vocab.indo}", skipping`);
          continue;
        }
      }
    }

    results.push({
      vocab_id: vocab.id,
      sentence_indo: sentenceIndo,
      sentence_english: sentenceEnglish,
      blank_answer: blankAnswer,
      explanation: (item.explanation || `The word "${blankAnswer}" is used in this context`).trim(),
    });
  }

  console.log(`✅ Generated ${results.length}/${vocabWords.length} valid sentences`);
  return results;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
