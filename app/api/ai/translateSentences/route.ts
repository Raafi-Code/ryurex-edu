import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

// Simple, reliable translation using a dedicated API or library
// For production, consider using: @google-cloud/translate or libre-translate
async function translateToEnglish(indonesianText: string): Promise<string> {
  try {
    // Using MyMemory API - free, no key required, reliable for Indonesian->English
    // Alternative: google-translate-api, lingva, or libre-translate
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        indonesianText
      )}&langpair=id|en`,
      {
        headers: {
          'User-Agent': 'Ryurex-Edu/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }

    throw new Error('Translation API returned no translation');
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
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

    // Rate limiting: 10 requests per minute per user
    const rateLimitResult = checkRateLimit(`translate-${user.id}`, RATE_LIMITS.NORMAL);
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

    const { sentences } = await req.json();

    if (!Array.isArray(sentences) || sentences.length === 0) {
      return NextResponse.json(
        { error: 'Sentences array is required and must not be empty', success: false },
        { status: 400 }
      );
    }

    console.log(`🌐 Translating ${sentences.length} sentences from Indonesian to English...`);

    // Translate each sentence
    const translatedSentences: Array<{ original: string; translated: string }> = [];

    for (const sentence of sentences) {
      try {
        const translated = await translateToEnglish(sentence);
        translatedSentences.push({
          original: sentence,
          translated: translated,
        });
        console.log(`✓ "${sentence}" -> "${translated}"`);
      } catch (error) {
        console.error(`Failed to translate: ${sentence}`, error);
        // Fallback to original if translation fails
        translatedSentences.push({
          original: sentence,
          translated: sentence,
        });
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`✅ Translated ${translatedSentences.length} sentences`);

    return NextResponse.json({
      success: true,
      translations: translatedSentences,
      count: translatedSentences.length,
    });
  } catch (error) {
    console.error('❌ Error in translateSentences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to translate sentences: ${errorMessage}`, success: false },
      { status: 500 }
    );
  }
}
