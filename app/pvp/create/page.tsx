'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Clock, Search } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import ThemeToggle from '@/components/ThemeToggle';

interface Category {
  name: string;
  count: number;
  subcategoryCount: number;
  hasSentences: boolean;
}

interface FormData {
  category: string;
  subcategoryMode: 'custom' | 'random';
  subcategory: number;
  numQuestions: number;
  timerDuration: number;
  gameMode: 'vocab' | 'ai';
}

export default function CreateLobbyPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    category: '',
    subcategoryMode: 'custom',
    subcategory: 1,
    numQuestions: 1,
    timerDuration: 5,
    gameMode: 'vocab',
  });

  const [maxQuestions, setMaxQuestions] = useState(0);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [subcategoryCount, setSubcategoryCount] = useState(0);

  const router = useRouter();
  const supabase = createClient();

  // Fetch user and check active lobby
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (isMounted) {
        if (!user) {
          router.push('/login');
        } else {
          setUser(user);
          // Check if user has an active lobby
          checkActiveLobby();
        }
        setLoading(false);
      }
    };

    const checkActiveLobby = async () => {
      try {
        const response = await fetch('/api/pvp/check-active-lobby');
        if (response.ok) {
          const data = await response.json();
          if (data.hasActiveLobby && data.lobby) {
            // Redirect to active lobby
            router.push(`/pvp/lobby/${data.lobby.gameCode}`);
          }
        }
      } catch (error) {
        console.error('Error checking active lobby:', error);
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [supabase.auth, router]);

  // Fetch categories
  useEffect(() => {
    if (!user) return;

    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };

    fetchCategories();
  }, [user]);

  // Calculate max questions based on subcategory choice
  useEffect(() => {
    if (!formData.category) {
      setMaxQuestions(0);
      setSubcategoryCount(0);
      return;
    }

    const selectedCategory = categories.find(c => c.name === formData.category);
    if (!selectedCategory) {
      setMaxQuestions(0);
      setSubcategoryCount(0);
      return;
    }

    // Set subcategory count for this category
    setSubcategoryCount(selectedCategory.subcategoryCount);

    if (formData.subcategoryMode === 'custom') {
      // Each subcategory has ~10 words (you can adjust this)
      setMaxQuestions(10);
    } else {
      // Random mode uses all words in category
      setMaxQuestions(selectedCategory.count);
    }

    // Reset num_questions if it exceeds max
    if (formData.numQuestions > maxQuestions) {
      setFormData(prev => ({ ...prev, numQuestions: 1 }));
    }
  }, [formData.category, formData.subcategoryMode, formData.numQuestions, categories, maxQuestions]);

  const handleFormChange = (field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    if (formData.numQuestions < 1 || formData.numQuestions > maxQuestions) {
      newErrors.numQuestions = `Please enter between 1 and ${maxQuestions} questions`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateGameCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !user) return;

    setSubmitting(true);

    try {
      const gameCode = generateGameCode();

      // Create lobby in database
      const { data, error } = await supabase
        .from('pvp_lobbies')
        .insert({
          host_user_id: user.id,
          game_code: gameCode,
          category: formData.category,
          subcategory: formData.subcategoryMode === 'custom' ? formData.subcategory : 0,
          num_questions: formData.numQuestions,
          timer_duration: formData.timerDuration,
          game_mode: formData.gameMode,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating lobby:', error);
        setErrors({ submit: 'Failed to create lobby. Please try again.' });
        return;
      }

      if (data) {
        // Redirect to lobby waiting page
        router.push(`/pvp/lobby/${gameCode}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setErrors({ submit: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/pvp')}
              className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to PvP</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-2">
              Create <span className="text-primary-yellow">Lobby</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Configure your battle and invite friends to compete
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            {errors.submit && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                {errors.submit}
              </div>
            )}

            {/* Section 1 & 2: Category and Subcategory in one row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Section 1: Choose Category */}
              <div className="bg-card rounded-2xl p-6 border border-theme">
                <h2 className="text-xl font-bold mb-4">Choose Category</h2>
                <div className="relative">
                  {/* Search Input */}
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search categories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsDropdownOpen(true)}
                      className="w-full pl-10 pr-4 py-2 bg-input border border-input rounded-lg text-foreground focus:outline-none focus:border-primary-yellow transition-colors"
                    />
                  </div>

                  {/* Dropdown List */}
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 w-full mt-1 bg-card border border-theme rounded-lg shadow-lg max-h-64 overflow-y-auto"
                    >
                      {categories
                        .filter(cat =>
                          cat.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map(cat => (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => {
                              handleFormChange('category', cat.name);
                              setSearchQuery('');
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-primary-yellow/10 transition-colors border-b border-theme last:border-b-0 cursor-pointer ${
                              formData.category === cat.name
                                ? 'bg-primary-yellow/20 text-primary-yellow font-semibold'
                                : 'text-foreground'
                            }`}
                          >
                            <div className="font-medium">{cat.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {cat.count} words
                            </div>
                          </button>
                        ))}
                      {categories.filter(cat =>
                        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="px-4 py-3 text-center text-muted-foreground text-sm">
                          No categories found
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Selected Category Display */}
                  {formData.category && !isDropdownOpen && (
                    <div className="px-4 py-2 bg-input border border-input rounded-lg text-foreground">
                      {categories.find(c => c.name === formData.category)?.name} (
                      {categories.find(c => c.name === formData.category)?.count} words)
                    </div>
                  )}

                  {/* Close dropdown on outside click */}
                  {isDropdownOpen && (
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsDropdownOpen(false)}
                    />
                  )}
                </div>
                {errors.category && (
                  <p className="text-red-400 text-sm mt-2">{errors.category}</p>
                )}
              </div>

              {/* Section 2: Choose Subcategory Mode */}
              {formData.category && (
                <div className="bg-card rounded-2xl p-6 border border-theme">
                  <h2 className="text-xl font-bold mb-4">Choose Subcategory</h2>
                  <div className="space-y-3">
                    {/* Custom Mode Button */}
                    <button
                      type="button"
                      onClick={() => {
                        handleFormChange('subcategoryMode', 'custom');
                        handleFormChange('subcategory', 1);
                      }}
                      className={`w-full p-4 rounded-lg transition-all cursor-pointer ${
                        formData.subcategoryMode === 'custom'
                          ? 'bg-primary-yellow text-black border border-primary-yellow'
                          : 'bg-background border border-theme hover:border-primary-yellow hover:bg-background/50'
                      }`}
                    >
                      <p className="font-semibold text-sm">Custom Mode</p>
                      <p className={`text-xs ${formData.subcategoryMode === 'custom' ? 'text-black/70' : 'text-muted-foreground'}`}>
                        Choose a part (max 10)
                      </p>
                    </button>

                    {/* Random Mode Button */}
                    <button
                      type="button"
                      onClick={() => handleFormChange('subcategoryMode', 'random')}
                      className={`w-full p-4 rounded-lg transition-all cursor-pointer ${
                        formData.subcategoryMode === 'random'
                          ? 'bg-primary-yellow text-black border border-primary-yellow'
                          : 'bg-background border border-theme hover:border-primary-yellow hover:bg-background/50'
                      }`}
                    >
                      <p className="font-semibold text-sm">Random Mode</p>
                      <p className={`text-xs ${formData.subcategoryMode === 'random' ? 'text-black/70' : 'text-muted-foreground'}`}>
                        Mix all parts
                      </p>
                    </button>

                    {/* Subcategory Selection (Custom Mode) - Dropdown */}
                    {formData.subcategoryMode === 'custom' && (
                      <div className="mt-4 pt-4 border-t border-theme">
                        <label className="block text-sm font-semibold mb-2">Select Part:</label>
                        <select
                          value={formData.subcategory}
                          onChange={(e) => handleFormChange('subcategory', parseInt(e.target.value))}
                          className="w-full px-4 py-3 bg-input border border-input rounded-lg text-foreground focus:outline-none focus:border-primary-yellow transition-colors cursor-pointer appearance-none"
                        >
                          {Array.from({ length: subcategoryCount }, (_, i) => i + 1).map(part => (
                            <option key={part} value={part}>
                              Part {part}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {formData.category && (
              <>
                {/* Section 3 & 4: Questions and Timer in one row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Section 3: Choose Number of Questions */}
                  <div className="bg-card rounded-2xl p-6 border border-theme">
                    <h2 className="text-xl font-bold mb-4">Number of Questions</h2>
                    <div className="space-y-5">
                      <input
                        type="number"
                        min="1"
                        max={maxQuestions}
                        value={formData.numQuestions}
                        onChange={(e) => handleFormChange('numQuestions', Math.max(1, Math.min(maxQuestions, parseInt(e.target.value) || 1)))}
                        className="w-full px-4 py-3 bg-input border border-input rounded-lg text-foreground focus:outline-none focus:border-primary-yellow transition-colors"
                      />
                      <div>
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span className="text-muted-foreground">Min: 1</span>
                          <span className="text-primary-yellow font-semibold">{formData.numQuestions} / {maxQuestions}</span>
                          <span className="text-muted-foreground">Max: {maxQuestions}</span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="range"
                            min="1"
                            max={maxQuestions}
                            value={formData.numQuestions}
                            onChange={(e) => handleFormChange('numQuestions', parseInt(e.target.value))}
                            className="w-full cursor-pointer"
                            style={{ '--value': `${((formData.numQuestions - 1) / (maxQuestions - 1 || 1)) * 100}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    </div>
                    {errors.numQuestions && (
                      <p className="text-red-400 text-sm mt-2">{errors.numQuestions}</p>
                    )}
                  </div>

                  {/* Section 4: Choose Timer */}
                  <div className="bg-card rounded-2xl p-6 border border-theme">
                    <h2 className="text-xl font-bold mb-4">Time per Question</h2>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-primary-yellow">{formData.timerDuration} seconds</span>
                        <Clock className="w-5 h-5 text-primary-yellow" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span className="text-muted-foreground">5 sec</span>
                          <span className="text-primary-yellow font-semibold">{formData.timerDuration}s</span>
                          <span className="text-muted-foreground">60 sec</span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="range"
                            min="5"
                            max="60"
                            step="5"
                            value={formData.timerDuration}
                            onChange={(e) => handleFormChange('timerDuration', parseInt(e.target.value))}
                            className="w-full cursor-pointer"
                            style={{ '--value': `${((formData.timerDuration - 5) / (60 - 5)) * 100}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Choose Game Mode - Smooth Toggle Slider */}
                <div className="bg-card rounded-2xl p-6 border border-theme">
                  <h2 className="text-xl font-bold mb-4">Game Mode</h2>
                  <div className="relative bg-background rounded-lg border border-theme p-1 flex">
                    {/* Sliding background */}
                    <div
                      className={`absolute top-1 bottom-1 w-1/2 bg-primary-yellow rounded-md transition-all duration-300 ease-out ${
                        formData.gameMode === 'ai' ? 'right-1 left-auto' : 'left-1'
                      }`}
                    />
                    
                    {/* Vocab Button */}
                    <button
                      type="button"
                      onClick={() => handleFormChange('gameMode', 'vocab')}
                      disabled={false}
                      className={`relative flex-1 py-2 px-4 font-semibold text-sm rounded-md transition-colors duration-300 z-10 cursor-pointer ${
                        formData.gameMode === 'vocab'
                          ? 'text-black'
                          : 'text-foreground hover:text-primary-yellow'
                      }`}
                    >
                      Vocab
                    </button>

                    {/* AI Mode Button */}
                    <button
                      type="button"
                      onClick={() => handleFormChange('gameMode', 'ai')}
                      disabled={false}
                      className={`relative flex-1 py-2 px-4 font-semibold text-sm rounded-md transition-colors duration-300 z-10 cursor-pointer flex items-center justify-center gap-1 ${
                        formData.gameMode === 'ai'
                          ? 'text-black'
                          : 'text-foreground hover:text-primary-yellow'
                      }`}
                    >
                      <span>Sentence Mode</span>
                      <span className="bg-primary-yellow text-black px-1 py-0.5 rounded text-xs font-bold">AI</span>
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-card rounded-2xl p-6 border border-theme">
                  <h2 className="text-lg font-bold mb-4 text-foreground">Battle Summary</h2>
                  <div className="bg-background rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-semibold text-primary-yellow">{formData.category}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mode:</span>
                      <span className="font-semibold text-primary-yellow">{formData.subcategoryMode === 'custom' ? `Part ${formData.subcategory}` : 'Random'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Questions:</span>
                      <span className="font-semibold text-primary-yellow">{formData.numQuestions}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Time per Q:</span>
                      <span className="font-semibold text-primary-yellow">{formData.timerDuration} sec</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-semibold text-secondary-purple capitalize">{formData.gameMode}</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={!submitting ? { scale: 1.02 } : {}}
                  whileTap={!submitting ? { scale: 0.98 } : {}}
                  className="w-full py-4 bg-primary-yellow text-black rounded-lg font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary-yellow-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  {submitting ? 'Creating Lobby...' : 'Create Lobby'}
                </motion.button>
              </>
            )}
          </motion.form>
        </div>
      </div>
    </div>
  );
}
