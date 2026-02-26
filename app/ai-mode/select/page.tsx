'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Search, ChevronLeft, ChevronRight, Brain } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import ScrollToTopButton from '@/components/ScrollToTopButton';
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
  learned_count?: number;
}

interface CategoryData {
  category: string;
  total_words: number;
  subcategories: Subcategory[];
}

interface Category {
  name: string;
  count: number;
  learned_count: number;
  subcategoryCount: number;
  hasSentences: boolean;
  icon: string;
}

// Category image mapping
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

export default function AiModeSelectPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const supabase = createClient();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const CATEGORIES_PER_PAGE = 10;

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

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      const data = await response.json();
      setCategories(data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategoryData = useCallback(async (categoryName: string) => {
    try {
      const response = await fetch(`/api/subcategories?category=${encodeURIComponent(categoryName)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch category data');
      }
      
      const data = await response.json();
      
      // Fetch user progress for this category
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData } = await supabase
          .from('user_vocab_progress')
          .select('vocab_id, fluency')
          .eq('user_id', user.id)
          .gt('fluency', 0);

        if (progressData) {
          const learnedVocabIds = new Set(progressData.map(p => p.vocab_id));
          
          // Get category id from categories table
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
              const learnedCountMap: { [key: string]: number } = {};
              mappingData.forEach(item => {
                const subcat = item.subcategory_name;
                learnedCountMap[subcat] = (learnedCountMap[subcat] || 0) + 1;
              });

              data.subcategories = data.subcategories.map((sub: Subcategory) => ({
                ...sub,
                learned_count: learnedCountMap[sub.subcategory_name] || 0
              }));
            }
          }
        }
      }
      
      setCategoryData(data);
    } catch (error) {
      console.error('Error fetching category data:', error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSelectCategory = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedSubcategory(null);
    fetchCategoryData(categoryName);
  };

  const handlePlayAiMode = () => {
    if (selectedCategory && selectedSubcategory !== null) {
      router.push(`/ai-mode?category=${encodeURIComponent(selectedCategory)}&subcategory=${encodeURIComponent(selectedSubcategory)}`);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
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
          <p className="text-body-sm text-text-secondary">Loading categories...</p>
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
            {/* Back Button - Dynamic based on selection state */}
            {selectedCategory ? (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setCategoryData(null);
                  setSelectedSubcategory(null);
                }}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Categories</span>
              </button>
            ) : (
              <button
                onClick={handleBackToDashboard}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Dashboard</span>
              </button>
            )}

            {/* Right Side Actions */}
            <div className="flex items-center space-x-3">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* If no category selected, show category grid */}
        {!selectedCategory ? (
          <div>
            <div className="mb-6 md:mb-8">
              <div className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg flex items-center justify-between">
                <div>
                  <h1 className="text-heading-1 mb-2 flex items-center gap-2 flex-wrap">
                    <span>Sentence Mode</span>
                    <span className="inline-block bg-primary-yellow text-black px-3 py-1 rounded text-heading-2 font-bold">AI</span>
                  </h1>
                  <p className="text-body-lg text-muted-foreground">
                    Choose a category to start learning with AI-generated sentences
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-secondary-purple rounded-lg md:rounded-2xl">
                    <Brain className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4 md:mb-6">
              <Search className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to page 1 when searching
                }}
                className="w-full pl-10 md:pl-12 pr-4 py-2 md:py-4 text-body-lg bg-card rounded-xl md:rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none transition-colors shadow-lg"
              />
            </div>

            {/* Category Grid */}
            {(() => {
              const filteredCategories = categories.filter(category =>
                category.name.toLowerCase().includes(searchQuery.toLowerCase())
              );

              // Calculate pagination
              const totalPages = Math.ceil(filteredCategories.length / CATEGORIES_PER_PAGE);
              const startIdx = (currentPage - 1) * CATEGORIES_PER_PAGE;
              const paginatedCategories = filteredCategories.slice(startIdx, startIdx + CATEGORIES_PER_PAGE);

              return filteredCategories.length > 0 ? (
                <div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
                    {paginatedCategories.map((category, index) => {
                      const learnedCount = category.learned_count || 0;
                      const totalWords = category.count;
                      const progressPercentage = totalWords > 0 ? (learnedCount / totalWords) * 100 : 0;

                      return (
                      <motion.div
                        key={category.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 + index * 0.05 }}
                      >
                        <button
                          onClick={() => handleSelectCategory(category.name)}
                          className="w-full"
                        >
                          <div className="group bg-card rounded-2xl hover:border-primary-yellow transition-all cursor-pointer h-full flex flex-col overflow-hidden shadow-lg">
                      {/* Image Container - Full width with rounded top corners */}
                            <div className="relative w-full aspect-square bg-gradient-to-br from-primary-yellow-light to-secondary-purple-light flex items-center justify-center">
                              <Image 
                                src={`/images/categories/${category.name.toLowerCase()}.svg`}
                                alt={category.name}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  // Fallback to default image if category image doesn't exist
                                  e.currentTarget.src = '/images/categories/default.svg';
                                }}
                              />
                              
                            </div>
                            
                            {/* Content Section */}
                            <div className="p-2 md:p-4 flex flex-col flex-grow">
                              {/* Category Name */}
                              <h3 className="text-heading-3 text-center mb-2 md:mb-3 group-hover:text-primary-yellow transition-colors">
                                {formatCategoryName(category.name)}
                              </h3>

                              {/* Progress Bar */}
                              <div className="mb-2 md:mb-4 space-y-1">
                                <div className="w-full bg-input border border-input rounded-full h-2 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercentage}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                className="h-full bg-secondary-purple"
                              />
                            </div>
                            <p className="text-label text-muted-foreground text-center">
                              {learnedCount} of {totalWords} learned
                            </p>
                          </div>
                          
                          {/* Play Button */}
                          <div className="w-full py-1 md:py-2 text-label bg-secondary-purple text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-secondary-purple/90 transition-colors group-hover:scale-105 cursor-pointer">
                            <Play className="w-3 h-3 md:w-4 md:h-4" />
                            Play
                          </div>
                        </div>
                      </div>
                    </button>
                  </motion.div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-secondary-purple border border-secondary-purple hover:bg-secondary-purple/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>

                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg font-bold text-base transition-colors cursor-pointer ${
                              currentPage === page
                                ? 'bg-secondary-purple text-white'
                                : 'bg-card hover:bg-card/80'
                            }`}
                            style={theme === 'dark' ? {
                              WebkitTextStroke: '2px #000000',
                              paintOrder: 'stroke fill'
                            } : undefined}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-secondary-purple border border-secondary-purple hover:bg-secondary-purple/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="w-12 h-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground text-body-lg">
                    No categories found matching &quot;{searchQuery}&quot;
                  </p>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Category selected, show subcategory selection */
          <div>
            {/* Header with Category Info Card */}
            <div className="mb-6 md:mb-8">
              <div className="bg-card rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg flex items-center justify-between">
                <div>
                  <h1 className="text-heading-1 mb-2">{formatCategoryName(selectedCategory)}</h1>
                  <p className="text-body-lg text-muted-foreground">
                    Select a topic to start practicing with Sentence Mode AI
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 bg-secondary-purple rounded-lg md:rounded-2xl">
                    <Brain className="w-6 h-6 md:w-8 md:h-8 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {categoryData && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side - Subcategory Cards */}
                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-heading-2 text-text-primary mb-6">
                    Choose a Topic
                  </h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categoryData.subcategories.map((sub, index) => {
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
                          className={`p-6 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                            selectedSubcategory === sub.subcategory_name
                              ? 'bg-primary-yellow border-primary-yellow text-black scale-105 shadow-lg'
                              : 'bg-primary-yellow border-primary-yellow text-black hover:scale-102 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-heading-3 font-bold">
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
                          <p className={`text-label mb-3 ${
                            selectedSubcategory === sub.subcategory_name ? 'text-black/70 font-medium' : 'text-black/60'
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
                              selectedSubcategory === sub.subcategory_name ? 'text-black/60 font-medium' : 'text-black/50'
                            }`}>
                              {learnedCount} of {totalWords} learned ({Math.round(progressPercentage)}%)
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side - Info & Play Button */}
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
                          src={categoryImages[selectedCategory.toLowerCase()] || '/images/categories/default.svg'}
                          alt={selectedCategory}
                          fill
                          className="object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <h2 className="text-heading-2 text-text-primary mb-2">
                          {formatCategoryName(selectedCategory)}
                        </h2>
                        <p className="text-body-lg text-text-secondary">
                          {categoryData.total_words} words total
                        </p>
                        <p className="text-label text-text-secondary/60 mt-1">
                          {categoryData.subcategories.length} topics available
                        </p>
                      </div>
                    </motion.div>

                    {/* Play Button */}
                    <button
                      onClick={handlePlayAiMode}
                      disabled={selectedSubcategory === null}
                      className={`w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer ${
                        selectedSubcategory !== null
                          ? 'bg-secondary-purple text-white hover:scale-105 hover:shadow-lg'
                          : 'bg-secondary-purple text-white opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-5 h-5" />
                      <span>Play Sentence Mode</span>
                      <span className="bg-primary-yellow text-black px-2 py-0.5 rounded text-label font-bold">AI</span>
                    </button>

                    {/* Info Text */}
                    {selectedSubcategory === null && (
                      <p className="text-center text-label text-text-secondary/60">
                        👆 Select a topic above to start playing
                      </p>
                    )}
                  </div>
                </div>

                {/* Mobile Play Button */}
                {selectedSubcategory !== null && (
                  <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="lg:hidden fixed bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/95 to-background/0 pt-4 pb-6 px-4 z-30"
                  >
                    <button
                      onClick={handlePlayAiMode}
                      className="w-full py-4 rounded-2xl font-bold text-body-lg flex items-center justify-center gap-3 transition-all cursor-pointer bg-secondary-purple text-white border-2 border-secondary-purple hover:scale-105 hover:shadow-lg active:scale-95"
                    >
                      <Play className="w-5 h-5" />
                      <span>Play Sentence Mode</span>
                      <span className="bg-primary-yellow text-black px-2 py-0.5 rounded text-label font-bold">AI</span>
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <ScrollToTopButton />
    </div>
  );
}
