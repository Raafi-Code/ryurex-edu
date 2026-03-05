import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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

    // ULTRA-OPTIMIZED: Call RPC function that does aggregation at database level
    // This avoids fetching ANY rows - database returns only aggregated counts
    const { data: categoryStats, error: rpcError } = await supabase
      .rpc('get_category_stats', { p_user_id: user.id });

    if (rpcError) {
      console.error('Error calling get_category_stats RPC:', rpcError);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    if (!categoryStats || categoryStats.length === 0) {
      return NextResponse.json({
        success: true,
        categories: [],
      });
    }

    // Fetch image_url from categories table
    const { data: categoriesData } = await supabase
      .from('categories')
      .select('name, image_url');

    const imageUrlMap: { [key: string]: string | null } = {};
    if (categoriesData) {
      categoriesData.forEach((cat: { name: string; image_url: string | null }) => {
        imageUrlMap[cat.name] = cat.image_url;
      });
    }

    // Convert RPC result to expected format
    const categoryStatsList = categoryStats.map((stat: any) => ({
      category: stat.category,
      count: stat.total_count || 0,
      learnedCount: stat.learned_count || 0,
      imageUrl: imageUrlMap[stat.category] || null
    }));

    console.log(`📚 Total categories: ${categoryStatsList.length}`);
    console.log(`✅ Categories fetched via RPC - ZERO row fetching!`);

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

    const formattedCategories = categoryStatsList.map((stat: { category: string; count: number; learnedCount: number; imageUrl: string | null }) => ({
      name: stat.category,
      count: stat.count,
      learned_count: stat.learnedCount,
      subcategoryCount: 1, // Default, can be enhanced later
      hasSentences: true, // Default, can be enhanced later
      icon: categoryIcons[stat.category] || '📚',
      image_url: stat.imageUrl,
    }));

    console.log(`✅ Categories API: ${formattedCategories.length} categories returned (optimized)`);

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
