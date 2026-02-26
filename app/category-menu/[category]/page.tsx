'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CompactNavbar from '@/components/CompactNavbar';
import Pagination from '@/components/Pagination';
import ScrollToTopButton from '@/components/ScrollToTopButton';
import LoadingScreen from '@/components/LoadingScreen';
import Footer from '@/components/Footer';
import { useTheme } from '@/context/ThemeContext';

// Helper function to convert 'a1-oxford' to 'A1 Oxford'
const formatCategoryName = (category: string): string => {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

interface Subcategory {
  subcategory_name: string;
  word_count: number;
  order_priority: number;
  learned_count?: number; // Words with fluency > 0
}

interface CategoryData {
  category: string;
  total_words: number;
  subcategories: Subcategory[];
}

interface VocabItem {
  id: number;
  english_primary: string;
  indo: string;
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
  'a2-oxford': '/images/categories/a2-oxford.svg',
  'b1-oxford': '/images/categories/b1-oxford.svg',
  'b2-oxford': '/images/categories/b2-oxford.svg',
  'c1-oxford': '/images/categories/c1-oxford.svg',
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
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [reviewModeCount, setReviewModeCount] = useState(0);
  const [categoryProgress, setCategoryProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [partsPerPage, setPartsPerPage] = useState(6); // Default for mobile (3 cols × 2 rows)
  const { theme } = useTheme();

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
      }
    };

    checkAuth();
  }, [router, supabase]);

  // Calculate responsive parts per page based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // Desktop: 5 cols × 3 rows = 15 cards
        setPartsPerPage(15);
      } else if (window.innerWidth >= 768) {
        // Tablet: 4 cols × 2 rows = 8 cards
        setPartsPerPage(8);
      } else {
        // Mobile: 3 cols × 2 rows = 6 cards
        setPartsPerPage(6);
      }
    };

    handleResize(); // Call on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
          
          // Fetch vocab_category_mapping for this category to map learned vocab_ids to subcategories
          const { data: catData } = await supabase
            .from('categories')
            .select('id')
            .eq('name', categoryName)
            .single();

          if (catData) {
            const { data: mappingData } = await supabase
              .from('vocab_category_mapping')
              .select('vocab_id, subcategory_name')
              .eq('category_id', catData.id)
              .in('vocab_id', Array.from(learnedVocabIds));

            if (mappingData) {
              // Count learned words per subcategory_name (topic)
              const learnedCountMap: { [key: string]: number } = {};
              mappingData.forEach(item => {
                const subcat = item.subcategory_name;
                learnedCountMap[subcat] = (learnedCountMap[subcat] || 0) + 1;
              });

              // Add learned_count to each subcategory
              data.subcategories = data.subcategories.map((sub: Subcategory) => ({
                ...sub,
                learned_count: learnedCountMap[sub.subcategory_name] || 0
              }));
            }
          }
        }
      }
      
      setCategoryData(data);

      // Calculate category progress
      const totalLearned = data.subcategories.reduce((sum: number, sub: Subcategory) => sum + (sub.learned_count || 0), 0);
      const categoryProgressPercent = data.total_words > 0 ? (totalLearned / data.total_words) * 100 : 0;
      setCategoryProgress(categoryProgressPercent);

      // Fetch review mode count (words due today from THIS category only)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get current date
          const today = new Date().toISOString().split('T')[0];
          
          // Fetch vocab items that are due today from this category
          // Step 1: Get category id
          const { data: catIdData } = await supabase
            .from('categories')
            .select('id')
            .eq('name', categoryName)
            .single();

          if (catIdData) {
            // Get all vocab IDs from mapping for this category
            const { data: categoryVocabMapping } = await supabase
              .from('vocab_category_mapping')
              .select('vocab_id')
              .eq('category_id', catIdData.id);

            if (categoryVocabMapping && categoryVocabMapping.length > 0) {
              const vocabIdList = categoryVocabMapping.map(v => v.vocab_id);
            
            // Step 2: Count vocab_progress entries that are due today and belong to this category
            const { data: dueVocabData, error } = await supabase
              .from('user_vocab_progress')
              .select('id')
              .eq('user_id', user.id)
              .lte('next_due', today)
              .in('vocab_id', vocabIdList);

            if (!error && dueVocabData) {
              setReviewModeCount(dueVocabData.length);
            }
            } else {
              setReviewModeCount(0);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching review mode count:', error);
      }
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

  useEffect(() => {
    const fetchVocabList = async () => {
      if (selectedSubcategory !== null && categoryName) {
        try {
          // Get category id
          const { data: catData } = await supabase
            .from('categories')
            .select('id')
            .eq('name', categoryName)
            .single();

          if (catData) {
            // Get vocab IDs from mapping for this subcategory
            const { data: mappingData } = await supabase
              .from('vocab_category_mapping')
              .select('vocab_id')
              .eq('category_id', catData.id)
              .eq('subcategory_name', selectedSubcategory);

            if (mappingData && mappingData.length > 0) {
              const vocabIds = mappingData.map(m => m.vocab_id);
              const { data: vocabData } = await supabase
                .from('vocab_master')
                .select('id, english_primary, indo')
                .in('id', vocabIds)
                .order('english_primary', { ascending: true });

              if (vocabData) {
                setVocabList(vocabData);
              } else {
                setVocabList([]);
              }
            } else {
              setVocabList([]);
            }
          }
        } catch (error) {
          console.error('Error fetching vocab list:', error);
          setVocabList([]);
        }
      } else {
        setVocabList([]);
      }
    };
    
    fetchVocabList();
  }, [selectedSubcategory, categoryName, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const handlePlayVocab = () => {
    if (selectedSubcategory !== null) {
      router.push(`/vocabgame?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(selectedSubcategory)}`);
    }
  };

  const handlePlayCategoryVocab = () => {
    // New feature: Play vocab with category filter (due today words from this category)
    router.push(`/review-mode?category=${encodeURIComponent(categoryName)}`);
  };

  const handlePlayAiMode = () => {
    if (selectedSubcategory !== null) {
      router.push(`/ai-mode?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(selectedSubcategory)}`);
    }
  };

  const handlePlaySentenceGame = () => {
    if (selectedSubcategory !== null) {
      router.push(`/sentence-box-mode?category=${encodeURIComponent(categoryName)}&subcategory=${encodeURIComponent(selectedSubcategory)}`);
    }
  };

  if (loading) {
    return <LoadingScreen title="Loading category..." />;
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
    <>
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <CompactNavbar title={categoryData ? formatCategoryName(categoryData.category) : ''} showBackButton={true} />

        {/* Main Content */}
        <div className={`px-4 sm:px-6 lg:px-8 pt-18 pb-12`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
            {/* Left Side - Subcategory Cards */}
            <div className="md:col-span-1 lg:col-span-5 space-y-3">
              {/* Cards Row 1: Review, Progress, Total Words - Responsive Layout */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Card 1: Review Mode Info & Button (Full width on mobile/tablet, 50% on desktop) */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="col-span-2 bg-card rounded-2xl p-4 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-text-secondary mb-1">Words to Review Today</div>
                      <div className="text-2xl font-bold text-primary-yellow">{reviewModeCount}</div>
                    </div>
                    <button
                      onClick={handlePlayCategoryVocab}
                      className="py-2 px-4 rounded-lg font-semibold text-sm bg-primary-yellow text-black hover:scale-105 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 inline mr-1" />
                      Review Mode
                    </button>
                  </div>
                </motion.div>

                {/* Card 2: Category Progress (50% on mobile/tablet, 25% on desktop) */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="col-span-1 bg-card rounded-2xl p-3 shadow-lg"
                >
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-2">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-background/50" />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-primary-yellow transition-all"
                          strokeDasharray={`${(categoryProgress / 100) * 282.7} 282.7`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-text-primary">{Math.round(categoryProgress)}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary">Category Progress</div>
                  </div>
                </motion.div>

                {/* Card 3: Words Learned vs Total (50% on mobile/tablet, 25% on desktop) */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="col-span-1 bg-card rounded-2xl p-3 shadow-lg"
                >
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-2">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-background/50" />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-primary-yellow transition-all"
                          strokeDasharray={`${(categoryProgress / 100) * 282.7} 282.7`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-text-primary">{categoryData ? categoryData.subcategories.reduce((sum: number, sub: Subcategory) => sum + (sub.learned_count || 0), 0) : 0}/{categoryData?.total_words || 0}</span>
                      </div>
                    </div>
                    <div className="text-xs text-text-secondary">Words Learned</div>
                  </div>
                </motion.div>
              </div>

            <h2 className="text-heading-3 text-text-primary mb-4">
              Choose a Topic
            </h2>
            
            {(() => {
              // Calculate pagination based on responsive partsPerPage
              const totalPages = Math.ceil(categoryData.subcategories.length / partsPerPage);
              const startIdx = (currentPage - 1) * partsPerPage;
              const paginatedParts = categoryData.subcategories.slice(startIdx, startIdx + partsPerPage);

              return (
                <div>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {paginatedParts.map((sub, index) => {
                      const learnedCount = sub.learned_count || 0;
                      const totalWords = sub.word_count;
                      const progressPercentage = totalWords > 0 ? (learnedCount / totalWords) * 100 : 0;
                      
                      return (
                        <motion.button
                          key={sub.subcategory_name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          onClick={() => setSelectedSubcategory(sub.subcategory_name)}
                          className={`p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                            selectedSubcategory === sub.subcategory_name
                              ? 'bg-primary-yellow border-primary-yellow text-black scale-105 shadow-lg'
                              : 'bg-primary-yellow border-primary-yellow text-black hover:scale-102 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-label font-bold">
                              {sub.subcategory_name}
                            </h3>
                            {selectedSubcategory === sub.subcategory_name && (
                              <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-primary-yellow" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <p className={`text-xs mb-2 ${
                            selectedSubcategory === sub.subcategory_name ? 'text-black/70 font-medium' : 'text-black/60'
                          }`}>
                            {sub.word_count} words
                          </p>
                          
                          {/* Progress Bar */}
                          <div className="space-y-0.5">
                            <div className="w-full bg-black/20 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-black h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPercentage}%` }}
                              />
                            </div>
                            <p className={`text-xs hidden sm:block ${
                              selectedSubcategory === sub.subcategory_name ? 'text-black/60 font-medium' : 'text-black/50'
                            }`}>
                              {learnedCount}/{totalWords} ({Math.round(progressPercentage)}%)
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <Pagination 
                      currentPage={currentPage} 
                      totalPages={totalPages} 
                      onPageChange={setCurrentPage}
                    />
                  )}
                </div>
              );
            })()}
            
          </div>

          {/* Right Side - Category Info & Play Buttons - Responsive */}
          <div className="md:col-span-1 lg:col-span-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Category Card - Hidden on mobile, Full width on tablet, 50% on desktop */}
              <div className="col-span-1 hidden md:block">
                {/* Category Card */}
                <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card rounded-2xl overflow-hidden shadow-lg"
              >
                {/* Image/Icon */}
                <div className="relative w-full aspect-video bg-gradient-to-br from-primary-yellow-light to-secondary-purple-light flex items-center justify-center overflow-hidden">
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
                <div className="p-4">
                  <h2 className="text-heading-3 text-text-primary mb-1">
                    {formatCategoryName(categoryName)}
                  </h2>
                </div>
                </motion.div>
              </div>

              {/* Buttons & Info - Full width on mobile/tablet, 50% on desktop */}
              <div className="col-span-1 space-y-2 flex flex-col">
                {/* Vocab Mode Button */}
                <button
                  onClick={handlePlayVocab}
                  disabled={selectedSubcategory === null}
                  className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedSubcategory !== null
                      ? 'bg-primary-yellow text-black hover:scale-105 hover:shadow-lg'
                      : 'bg-primary-yellow text-black opacity-50 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Vocab Mode
                </button>

                {/* AI Mode Button */}
                {selectedSubcategory !== null && (
                  <button
                    onClick={handlePlayAiMode}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-secondary-purple text-white hover:scale-105 hover:shadow-lg"
                  >
                    <Play className="w-4 h-4" />
                    <span>Sentence Mode</span>
                    <span className="bg-primary-yellow text-black px-1.5 py-0.5 rounded text-xs">AI</span>
                  </button>
                )}

                {/* Sentence Click Game Button */}
                {selectedSubcategory !== null && (
                  <button
                    onClick={handlePlaySentenceGame}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-secondary-purple text-white hover:scale-105 hover:shadow-lg"
                  >
                    <Play className="w-4 h-4" />
                    <span>Sentence Click</span>
                    <span className="bg-primary-yellow text-black px-1.5 py-0.5 rounded text-xs">AI</span>
                  </button>
                )}
              </div>

              {/* Info Text */}
              {selectedSubcategory === null && (
                <p className="text-center text-xs text-text-secondary/60">
                  👆 Select a topic above
                </p>
              )}

              {/* Vocab List Table - Full width below both 50-50 cards */}
              {selectedSubcategory !== null && vocabList.length > 0 && (
                <div className="bg-card rounded-2xl overflow-hidden col-span-1 lg:col-span-2 mt-auto shadow-lg">
                  <div className="bg-primary-yellow/20 px-3 py-2 border-b border-primary-yellow/20">
                    <div className="text-sm font-semibold text-text-primary">
                      Words in {selectedSubcategory}
                    </div>
                  </div>
                  <div className="overflow-hidden">
                    {vocabList.map((vocab, index) => (
                      <div key={vocab.id} className={`px-3 py-1 flex ${index % 2 === 0 ? 'bg-background/50' : 'bg-background'}`}>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-text-primary">
                            {vocab.english_primary}
                          </div>
                        </div>
                        <div className="border-l border-primary-yellow/30\"></div>
                        <div className="flex-1 pl-3">
                          <div className="text-sm font-medium text-text-primary">
                            {vocab.indo}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Scroll to Top Button */}
        <ScrollToTopButton />
      </div>

      {/* Footer */}
      <Footer />
    </>
  );
}
