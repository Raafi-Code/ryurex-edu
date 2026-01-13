'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import ScrollToTopButton from '@/components/ScrollToTopButton';

// Helper function to convert 'a1-oxford' to 'A1 Oxford'
const formatCategoryName = (category: string): string => {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface Subcategory {
  subcategory: number;
  word_count: number;
  learned_count?: number; // Words with fluency > 0
}

interface CategoryData {
  category: string;
  total_words: number;
  subcategories: Subcategory[];
}

// Category image mapping (use same images as dashboard)
const categoryImages: { [key: string]: string } = {
  'emotion': '/images/categories/emotion.svg',
  'family': '/images/categories/family.svg',
  'food': '/images/categories/food.svg',
  'action': '/images/categories/action.svg',
  'nature': '/images/categories/nature.svg',
  'animal': '/images/categories/animal.svg',
  'color': '/images/categories/color.svg',
  'body': '/images/categories/body.svg',
  'time': '/images/categories/time.svg',
  'place': '/images/categories/place.svg',
  'object': '/images/categories/object.svg',
  'a1-oxford': '/images/categories/a1-oxford.svg',
};

// Fallback emoji if image not found
const categoryEmojis: { [key: string]: string } = {
  'emotion': '😊',
  'family': '👨‍👩‍👧‍👦',
  'food': '🍕',
  'action': '🏃',
  'nature': '🌳',
  'animal': '🐶',
  'color': '🎨',
  'body': '👤',
  'time': '⏰',
  'place': '🏠',
  'object': '📦',
  'a1-oxford': '📚',
};

export default function CategoryMenuPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  
  const categorySlug = params.category as string;
  const categoryName = categorySlug ? decodeURIComponent(categorySlug) : '';

  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCategoryData = useCallback(async () => {
    try {
      // Fetch category data with subcategories
      const response = await fetch(`/api/subcategories?category=${encodeURIComponent(categoryName)}`);
      if (!response.ok) {
        console.error('Failed to fetch category data');
        router.push('/dashboard');
        return;
      }
      
      const data = await response.json();
      
      // Fetch user progress for this category to calculate learned words per subcategory
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData, error } = await supabase
          .from('user_vocab_progress')
          .select('vocab_id, fluency')
          .eq('user_id', user.id)
          .gt('fluency', 0);

        if (!error && progressData) {
          // Get vocab IDs that have fluency > 0
          const learnedVocabIds = new Set(progressData.map(p => p.vocab_id));
          
          // Fetch vocab data to map vocab_id to subcategory
          const { data: vocabData } = await supabase
            .from('vocab_master')
            .select('id, subcategory')
            .eq('category', categoryName)
            .in('id', Array.from(learnedVocabIds));

          if (vocabData) {
            // Count learned words per subcategory
            const learnedCountMap: { [key: number]: number } = {};
            vocabData.forEach(vocab => {
              const subcat = vocab.subcategory || 1;
              learnedCountMap[subcat] = (learnedCountMap[subcat] || 0) + 1;
            });

            // Add learned_count to each subcategory
            data.subcategories = data.subcategories.map((sub: Subcategory) => ({
              ...sub,
              learned_count: learnedCountMap[sub.subcategory] || 0
            }));
          }
          }
        }
      
      setCategoryData(data);
    } catch (error) {
      console.error('Error fetching category data:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [categoryName, supabase, router]);

  useEffect(() => {
    if (categoryName) {
      fetchCategoryData();
    }
  }, [categoryName, fetchCategoryData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const handlePlayVocab = () => {
    if (selectedSubcategory !== null) {
      router.push(`/vocabgame?category=${encodeURIComponent(categoryName)}&subcategory=${selectedSubcategory}`);
    }
  };

  const handlePlayCategoryVocab = () => {
    // New feature: Play vocab with category filter (due today words from this category)
    router.push(`/vocab?category=${encodeURIComponent(categoryName)}`);
  };

  const handlePlayAiMode = () => {
    if (selectedSubcategory !== null) {
      router.push(`/ai-mode?category=${encodeURIComponent(categoryName)}&subcategory=${selectedSubcategory}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="spinner-loading"
            />
          </div>
          <p className="text-body-sm text-text-secondary">Loading category...</p>
        </div>
      </div>
    );
  }

  if (!categoryData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Category not found</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-6 py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Floating Action Buttons */}
      {selectedSubcategory !== null && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-background/0 pt-4 pb-6 px-4 space-y-3 z-30"
        >
          {/* Vocab Mode Button */}
          <button
            onClick={handlePlayVocab}
            className="w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer bg-primary-yellow text-black border-2 border-black hover:scale-105 hover:shadow-lg active:scale-95"
          >
            <Play className="w-5 h-5" />
            Play Vocab Mode
          </button>

          {/* AI Mode Button */}
          <button
            onClick={handlePlayAiMode}
            className="w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer bg-black dark:bg-white text-white dark:text-black border-2 border-black dark:border-white hover:scale-105 hover:shadow-lg active:scale-95"
          >
            <Play className="w-5 h-5" />
            Play AI Mode
          </button>
        </motion.div>
      )}

      {/* Main Content - Add padding-bottom for mobile floating buttons */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 ${selectedSubcategory !== null ? 'lg:pb-12 pb-40' : 'pb-12'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Subcategory Cards */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-heading-2 text-text-primary mb-6">
              Choose a Part
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categoryData.subcategories.map((sub, index) => {
                const learnedCount = sub.learned_count || 0;
                const totalWords = sub.word_count;
                const progressPercentage = totalWords > 0 ? (learnedCount / totalWords) * 100 : 0;
                
                return (
                  <motion.button
                    key={sub.subcategory}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setSelectedSubcategory(sub.subcategory)}
                    className={`p-6 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                      selectedSubcategory === sub.subcategory
                        ? 'bg-primary-yellow border-primary-yellow text-black scale-105 shadow-lg'
                        : 'bg-primary-yellow border-primary-yellow text-black hover:scale-102 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-heading-3 font-bold">
                        Part {sub.subcategory}
                      </h3>
                      {selectedSubcategory === sub.subcategory && (
                        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-yellow" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className={`text-label mb-3 ${
                      selectedSubcategory === sub.subcategory ? 'text-black/70 font-medium' : 'text-black/60'
                    }`}>
                      {sub.word_count} words
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-black h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                      <p className={`text-label text-xs ${
                        selectedSubcategory === sub.subcategory ? 'text-black/60 font-medium' : 'text-black/50'
                      }`}>
                        {learnedCount} of {totalWords} learned ({Math.round(progressPercentage)}%)
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right Side - Category Info & Play Buttons */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Category Card */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card border-2 border-theme rounded-2xl overflow-hidden"
              >
                {/* Image/Icon */}
                <div className="relative w-full aspect-square bg-gradient-to-br from-primary-yellow-light to-secondary-purple-light flex items-center justify-center overflow-hidden">
                  <Image
                    src={categoryImages[categoryName.toLowerCase()] || '/images/categories/default.svg'}
                    alt={categoryName}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      // Fallback to emoji if image fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* Emoji fallback if image fails */}
                  <div className="text-8xl absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}>
                    {categoryEmojis[categoryName.toLowerCase()] || '📚'}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h2 className="text-heading-2 text-text-primary mb-2">
                    {formatCategoryName(categoryName)}
                  </h2>
                  <p className="text-body-lg text-text-secondary">
                    {categoryData.total_words} words total
                  </p>
                  <p className="text-label text-text-secondary/60 mt-1">
                    {categoryData.subcategories.length} parts available
                  </p>
                </div>
              </motion.div>

              {/* Play Buttons */}
              <div className="space-y-3">
                {/* Category Vocab Mode Button - Due Today words from this category */}
                <button
                  onClick={handlePlayCategoryVocab}
                  className="w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer bg-primary-yellow text-black hover:scale-105 hover:shadow-lg"
                >
                  <Play className="w-5 h-5" />
                  Play Category Vocab
                </button>

                {/* Vocab Mode Button */}
                <button
                  onClick={handlePlayVocab}
                  disabled={selectedSubcategory === null}
                  className={`w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer ${
                    selectedSubcategory !== null
                      ? 'bg-primary-yellow text-black hover:scale-105 hover:shadow-lg'
                      : 'bg-primary-yellow text-black opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5" />
                  Play Vocab Mode
                </button>

                {/* AI Mode Button */}
                {selectedSubcategory !== null && (
                  <button
                    onClick={handlePlayAiMode}
                    className="w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer bg-secondary-purple text-white hover:scale-105 hover:shadow-lg"
                  >
                    <Play className="w-5 h-5" />
                    <span>Play Sentence Mode</span>
                    <span className="bg-primary-yellow text-black px-2 py-0.5 rounded text-label">AI</span>
                  </button>
                )}
              </div>

              {/* Info Text */}
              {selectedSubcategory === null && (
                <p className="text-center text-label text-text-secondary/60">
                  👆 Select a part above to start playing
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTopButton />
    </div>
  );
}
