import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
      throw new Error('Groq SDK not available');
    }
  }
  return groqClient;
}

// Generate AI sentences directly using Groq
async function generateAISentencesWithGroq(
  supabase: any,
  category: string,
  subcategory: number,
  numQuestions: number
) {
  try {
    console.log('🤖 Fetching vocab words for AI generation...');
    console.log('📝 Category:', category, 'Subcategory:', subcategory, 'NumQuestions:', numQuestions);
    
    // Fetch vocab words from database
    let query = supabase
      .from('vocab_master')
      .select('id, indo, english, class, category, subcategory')
      .eq('category', category);
    
    // If subcategory is 0 (Random mode), fetch from all subcategories
    // Otherwise, fetch from specific subcategory
    if (subcategory !== 0) {
      query = query.eq('subcategory', subcategory);
    }
    
    const { data: vocabData, error: fetchError } = await query
      .order('id')
      .limit(numQuestions);

    if (fetchError || !vocabData || vocabData.length === 0) {
      console.error('Failed to fetch vocab words:', fetchError);
      return null;
    }

    const vocabWords = vocabData as Array<{
      id: string;
      indo: string;
      english: string;
      class: string;
      category: string;
      subcategory: number;
    }>;

    console.log(`✅ Fetched ${vocabWords.length} vocab words`);

    // Initialize Groq
    const groq = await initializeGroq();

    // Generate sentences with Groq
    const indonesianWords = vocabWords.map((w) => `"${w.indo}"`).join(', ');
    
    const randomSeed = Math.random().toString(36).substring(7);
    const contextVariety = ['daily life', 'work/school', 'social situations', 'creative scenarios', 'practical uses'];
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

    console.log('📝 Calling Groq API...');

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
    console.log('✅ Groq response received');

    // Parse JSON response
    let generatedSentences: Array<{ word: string; sentence_indo: string; sentence_english: string }> = [];
    try {
      const jsonMatch = generatedContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedSentences = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Groq response:', parseError);
      return null;
    }

    // Create sentence maps
    const sentenceMapIndo = new Map<string, string>();
    const sentenceMapEnglish = new Map<string, string>();
    generatedSentences.forEach(item => {
      const cleanedSentenceIndo = item.sentence_indo.trim().replace(/\.$/, '');
      const cleanedSentenceEnglish = item.sentence_english.trim().replace(/\.$/, '');
      sentenceMapIndo.set(item.word.toLowerCase().trim(), cleanedSentenceIndo);
      sentenceMapEnglish.set(item.word.toLowerCase().trim(), cleanedSentenceEnglish);
    });

    // Build result
    const vocabWithAiSentences = vocabWords.map(vocab => ({
      vocab_id: vocab.id,
      indo: vocab.indo,
      english: vocab.english,
      class: vocab.class,
      category: vocab.category,
      subcategory: vocab.subcategory,
      sentence_indo: sentenceMapIndo.get(vocab.indo.toLowerCase()) || `${vocab.indo} adalah...`,
      sentence_english: sentenceMapEnglish.get(vocab.indo.toLowerCase()) || `This is a ${vocab.english}...`,
    }));

    console.log(`✅ Generated ${vocabWithAiSentences.length} AI sentences for PvP game`);
    return vocabWithAiSentences;
  } catch (error) {
    console.error('Error generating AI sentences:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lobbyId } = await request.json();

    if (!lobbyId) {
      return NextResponse.json(
        { error: 'Missing lobbyId' },
        { status: 400 }
      );
    }

    // Fetch lobby data
    const { data: lobby, error: fetchError } = await supabase
      .from('pvp_lobbies')
      .select('*')
      .eq('id', lobbyId)
      .single();

    if (fetchError || !lobby) {
      return NextResponse.json(
        { error: 'Lobby not found' },
        { status: 404 }
      );
    }

    // Verify user is in this lobby
    if (user.id !== lobby.host_user_id && user.id !== lobby.joined_user_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Generate or fetch cached questions for AI mode
    let questionsData = null;
    if (lobby.game_mode === 'ai') {
      // Check if questions are already cached
      if (lobby.questions_data) {
        questionsData = lobby.questions_data;
        console.log('📚 Using cached questions from database');
      } else {
        // Generate AI sentences for this game
        console.log('🤖 Generating AI sentences for PvP game...');
        
        questionsData = await generateAISentencesWithGroq(
          supabase,
          lobby.category,
          lobby.subcategory,
          lobby.num_questions
        );
        
        if (!questionsData) {
          console.error('Failed to generate AI sentences');
          return NextResponse.json(
            { error: 'Failed to generate questions' },
            { status: 500 }
          );
        }
      }
    } else {
      // For vocab mode (including Random mode), questions will be fetched from game page
      console.log('📚 Vocab mode: Game will fetch questions from getCustomBatch API');
    }

    // Update lobby status to in_progress and cache questions (if available)
    const updateData: any = {
      status: 'in_progress',
      started_at: new Date().toISOString(),
    };
    
    if (questionsData) {
      updateData.questions_data = questionsData;
    }
    
    const { error: updateError } = await supabase
      .from('pvp_lobbies')
      .update(updateData)
      .eq('id', lobbyId);

    if (updateError) {
      console.error('Error updating lobby status:', updateError);
      return NextResponse.json(
        { error: 'Failed to start game' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Game started',
      questions: questionsData,
    });
  } catch (error) {
    console.error('Error in start-game:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
