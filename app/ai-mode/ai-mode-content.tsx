'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Lightbulb, ArrowLeft, RotateCcw, Home, BookOpen, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import LoadingScreen from '@/components/LoadingScreen';
import { useTheme } from '@/context/ThemeContext';

interface AiSentenceWord {
  id: number;
  indo: string;
  english: string;
  class: string;
  category: string;
  subcategory: number;
  sentence_indo: string;
  sentence_english: string;
}

interface GameResult {
  vocab_id: number;
  correct: boolean;
  hintClickCount: number;
  userAnswer: string;
  // Store the full question data to prevent lookup issues
  questionData?: AiSentenceWord;
}

export default function AiModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const supabase = createClient();

  // Game state
  const [sentences, setSentences] = useState<AiSentenceWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [hintClickCount, setHintClickCount] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing AI Mode...');
  const [showResultModal, setShowResultModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0); // Track current review item
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Reset all game state when category or subcategory changes
  useEffect(() => {
    setSentences([]);
    setCurrentIndex(0);
    setUserAnswer('');
    setHintClickCount(0);
    setFeedback(null);
    setIsSubmitting(false);
    setGameResults([]);
    setIsLoading(true);
    setShowResultModal(false);
    setShowReviewModal(false);
    setReviewIndex(0);
    setIsSubmittingResults(false);
    setError(null);
  }, [category, subcategory]);

  // Fetch and generate AI sentences on mount
  useEffect(() => {
    if (!category || !subcategory) {
      alert('Category and Subcategory are required!');
      router.push('/dashboard');
      return;
    }

    let isMounted = true;

    const loadAiSentences = async () => {
      try {
        // Step 1: Generate Indonesian sentences using Groq
        setLoadingMessage('Generating Indonesian sentences with AI...');

        const generateResponse = await fetch('/api/ai/generateSentences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            subcategory: parseInt(subcategory),
          }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.error || 'Failed to generate sentences');
        }

        const generatedData = await generateResponse.json();

        if (!generatedData.words || generatedData.words.length === 0) {
          throw new Error('No sentences were generated');
        }

        // Sentences now include both Indonesian and English translations from Groq
        if (isMounted) {
          setSentences(generatedData.words);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Error loading AI sentences:', error);
        if (isMounted) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          setError(errorMessage);
          setIsLoading(false);
        }
      }
    };

    loadAiSentences();

    return () => {
      isMounted = false;
    };
  }, [category, subcategory]);

  const currentSentence = sentences[currentIndex];

  const resetQuestion = () => {
    setUserAnswer('');
    setHintClickCount(0);
    setFeedback(null);
    setIsSubmitting(false);
  };

  const handleHintClick = () => {
    setHintClickCount((prev) => prev + 1);
  };

  const getMaxWordLength = (sentence: string) => {
    const words = sentence.split(/\s+/);
    const maxLength = Math.max(
      ...words.map((word) => word.replace(/[^a-zA-Z]/g, '').length)
    );
    return maxLength;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setUserAnswer(newValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSubmitting && !feedback) {
      if (userAnswer.trim()) {
        handleSubmit();
      }
    }
  };

  const renderUnderscoreDisplay = () => {
    if (!currentSentence) return null;

    const correctSentence = currentSentence.sentence_english;
    const words = correctSentence.split(/\s+/);

    return words.map((word, wordIdx) => {
      const letters = word.split('');

      return (
        <span key={wordIdx}>
          {letters.map((letter, letterIdx) => {
            if (!/[a-zA-Z]/.test(letter)) {
              return <span key={letterIdx}>{letter}</span>;
            }

            if (letterIdx < hintClickCount) {
              return (
                <span key={letterIdx} className="text-primary-yellow font-bold">
                  {letter}
                </span>
              );
            }

            const userWords = userAnswer
              .trim()
              .split(/\s+/)
              .filter((w) => w.length > 0);
            if (userWords[wordIdx] && userWords[wordIdx][letterIdx]) {
              return (
                <span key={letterIdx} className="text-text-primary">
                  {userWords[wordIdx][letterIdx]}
                </span>
              );
            }

            return (
              <span key={letterIdx} className="text-text-secondary">
                _
              </span>
            );
          })}
          {wordIdx < words.length - 1 && <span> </span>}
        </span>
      );
    });
  };

  // Helper function to highlight the vocabulary word in the sentence
  const renderSentenceWithBadge = () => {
    const sentence = currentSentence.sentence_indo;
    const vocabWordIndo = currentSentence.indo.toLowerCase();
    
    // Split by common separators but keep them
    const parts = sentence.split(/(\s+|[.,!?;:'"()-])/);
    
    return parts.map((part, index) => {
      if (!part) return null;
      
      // Check if this part matches the vocabulary word in Indonesian (case-insensitive)
      if (part.toLowerCase() === vocabWordIndo) {
        return (
          <span key={index} className="inline-block bg-primary-yellow text-black px-2 py-1 rounded font-semibold mx-1">
            {part}
          </span>
        );
      }
      
      return <span key={index}>{part}</span>;
    });
  };

  const handleSubmit = () => {
    if (isSubmitting || !userAnswer.trim()) return;

    setIsSubmitting(true);

    const userWords = userAnswer
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase().replace(/[.,!?;:'"]/g, ''));

    const correctWords = currentSentence.sentence_english
      .trim()
      .split(/\s+/)
      .map((w) => w.toLowerCase().replace(/[.,!?;:'"]/g, ''));

    const isCorrect =
      userWords.length === correctWords.length &&
      userWords.every((word, idx) => word === correctWords[idx]);

    setFeedback(isCorrect ? 'correct' : 'wrong');

    const result: GameResult = {
      vocab_id: currentSentence.id,
      correct: isCorrect,
      hintClickCount,
      userAnswer: userAnswer.trim(),
      questionData: currentSentence, // Store full question data
    };
    setGameResults((prev) => [...prev, result]);

    setTimeout(() => {
      if (currentIndex < sentences.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        resetQuestion();
      } else {
        submitAllResults([...gameResults, result]);
      }
    }, 2000);
  };

  const submitAllResults = async (results: GameResult[]) => {
    setIsSubmittingResults(true);
    try {
      const response = await fetch('/api/ai/submitScore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results,
          category,
          subcategory: parseInt(subcategory || '0'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit results');
      }

      const data = await response.json();

      setShowResultModal(true);
    } catch (error) {
      console.error('❌ Error submitting results:', error);
      alert(`Failed to submit results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingResults(false);
    }
  };

  const handleRetry = () => {
    router.push(`/ai-mode?category=${encodeURIComponent(category || '')}&subcategory=${subcategory}`);
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  const handleBackToCategory = () => {
    router.back();
  };

  // Loading state
  if (isLoading) {
    return <LoadingScreen title={loadingMessage} icon={<Sparkles className="w-12 h-12 text-primary-yellow" />} />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-body-sm sm:text-body-lg text-text-secondary mb-4">❌ {error}</p>
          <div className="flex gap-2 sm:gap-3 justify-center flex-col sm:flex-row">
            <button
              onClick={handleRetry}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
            >
              Try Again
            </button>
            <button
              onClick={handleBackToCategory}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-text-secondary/20 text-text-primary rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (sentences.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-body-sm sm:text-body-lg text-text-secondary mb-4">No sentences available</p>
          <button
            onClick={handleBackToCategory}
            className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
          >
            Back to Category
          </button>
        </div>
      </div>
    );
  }

  // Result modal
  if (showResultModal) {
    const correctCount = gameResults.filter((r) => r.correct).length;
    const accuracy =
      gameResults.length > 0
        ? Math.round((correctCount / gameResults.length) * 100)
        : 0;

    // AI Mode doesn't track time by default, focus on accuracy and hints instead
    const avgTime = 'N/A';
    const totalTime = 0;
    
    // Format total time to MM:SS
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate total XP gained (same logic as backend)
    let totalXpGained = 0;
    gameResults.forEach((result) => {
      if (result.correct) {
        if (result.hintClickCount === 0) {
          totalXpGained += 10; // Full XP - no hint
        } else if (result.hintClickCount === 1) {
          totalXpGained += 5; // 50% XP - 1 hint
        } else {
          totalXpGained += 1; // Minimal XP - 2+ hints
        }
      }
      // Wrong answer = 0 XP in AI Mode
    });

    const wrongAnswers = gameResults.filter((r) => !r.correct);

    return (
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <div className="border-b border-text-secondary/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (category) {
                    router.back();
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow hover:font-semibold transition-colors cursor-pointer flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-body-sm">{category ? 'Back to Category' : 'Back to Dashboard'}</span>
              </button>
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* Result Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border-2 border-theme rounded-3xl p-6 sm:p-8 text-center"
          >
            <h2 className="text-heading-2 sm:text-heading-1 font-bold mb-6 sm:mb-8 text-primary-yellow">Session Complete!</h2>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
              <div className="bg-black/10 dark:bg-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-label text-text-secondary mb-1">Accuracy</p>
                <p className="text-heading-3 font-bold text-text-primary">{accuracy}%</p>
              </div>
              <div className="bg-black/10 dark:bg-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-label text-text-secondary mb-1">Total Time</p>
                <p className="text-heading-3 font-bold text-text-primary">{formatTime(totalTime)}</p>
              </div>
              <div className="bg-black/10 dark:bg-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-label text-text-secondary mb-1">Avg Time</p>
                <p className="text-heading-3 font-bold text-text-primary">{avgTime}s</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 sm:gap-3">
              {/* Play Again & Back Row */}
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 sm:py-4 rounded-2xl font-bold text-body-sm sm:text-body-lg text-white bg-secondary-purple hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                  Play Again
                </button>

                <button
                  onClick={handleBackToCategory}
                  className="flex-1 py-3 sm:py-4 rounded-2xl font-bold text-body-sm sm:text-body-lg text-white bg-black border-2 border-primary-yellow hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                  Back
                </button>
              </div>

              {/* Review Button */}
              {wrongAnswers.length > 0 && (
                <button
                  onClick={() => {
                    setShowReviewModal(!showReviewModal);
                    if (showReviewModal) {
                      setReviewIndex(0);
                    }
                  }}
                  className="w-full py-3 sm:py-4 rounded-2xl font-bold text-body-sm sm:text-body-lg text-black bg-primary-yellow hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  Review ({wrongAnswers.length})
                  {showReviewModal ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              )}
            </div>
          </motion.div>

          {/* Review Section - Expandable Carousel */}
          <AnimatePresence>
            {showReviewModal && wrongAnswers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6 overflow-hidden"
              >
                <div className="bg-card border-2 border-theme rounded-2xl p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-heading-3 font-bold text-primary-yellow">
                      Review: Wrong Answers
                    </h3>
                    <p className="text-label text-text-secondary font-medium">
                      {reviewIndex + 1} / {wrongAnswers.length}
                    </p>
                  </div>

                  {/* Carousel Container */}
                  <div className="relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={reviewIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 sm:p-5"
                      >
                        {(() => {
                          const wrongResult = wrongAnswers[reviewIndex];
                          
                          // First try to use stored question data, then fallback to lookup
                          let originalQuestion = wrongResult.questionData;
                          
                          if (!originalQuestion) {
                            originalQuestion = sentences.find((s) => s.id === wrongResult.vocab_id);
                          }

                          if (!originalQuestion) {
                            console.warn(`❌ Question with vocab_id ${wrongResult.vocab_id} not found. Wrong answer: ${wrongResult.userAnswer}`);
                            return (
                              <div className="text-center py-8">
                                <p className="text-text-secondary">Question data not found</p>
                              </div>
                            );
                          }

                          return (
                            <div>
                              {/* Indonesian Sentence */}
                              <p className="text-body-sm sm:text-body-lg text-text-primary font-medium mb-4 leading-relaxed">
                                {originalQuestion.sentence_indo}
                              </p>

                              {/* Word Badge - Highlight the vocab word */}
                              <div className="mb-4 flex items-center gap-2 flex-wrap">
                                <p className="text-label text-text-secondary font-medium">Vocabulary:</p>
                                <span className="inline-block bg-primary-yellow text-black px-3 py-1 rounded font-semibold text-body-sm">
                                  {originalQuestion.indo}
                                </span>
                              </div>

                              {/* Comparison Grid */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                {/* Your Answer */}
                                <div className="bg-orange-100 dark:bg-orange-950 rounded-lg p-3 sm:p-4 border-l-3 border-orange-500">
                                  <p className="text-label text-orange-700 dark:text-orange-400 font-bold uppercase mb-1">Jawaban Kamu</p>
                                  <p className="text-body-sm text-orange-900 dark:text-orange-300 break-words font-mono leading-relaxed min-h-[2.5rem] flex items-center">
                                    {wrongResult.userAnswer || '(empty)'}
                                  </p>
                                </div>

                                {/* Correct Answer */}
                                <div className="bg-green-100 dark:bg-green-950 rounded-lg p-3 sm:p-4 border-l-3 border-green-500">
                                  <p className="text-label text-green-700 dark:text-green-400 font-bold uppercase mb-1">Jawaban Benar</p>
                                  <p className="text-body-sm text-green-900 dark:text-green-300 break-words font-mono leading-relaxed min-h-[2.5rem] flex items-center">
                                    {originalQuestion.sentence_english}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between gap-4 mt-6">
                      <button
                        onClick={() => setReviewIndex((prev) => (prev === 0 ? wrongAnswers.length - 1 : prev - 1))}
                        disabled={wrongAnswers.length <= 1}
                        className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-primary-yellow text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 rotate-90" />
                      </button>

                      {/* Dots Indicator */}
                      <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
                        {wrongAnswers.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setReviewIndex(idx)}
                            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all cursor-pointer ${
                              idx === reviewIndex
                                ? 'bg-primary-yellow w-6 sm:w-8'
                                : 'bg-text-secondary/30 hover:bg-text-secondary/50'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        onClick={() => setReviewIndex((prev) => (prev === wrongAnswers.length - 1 ? 0 : prev + 1))}
                        disabled={wrongAnswers.length <= 1}
                        className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-primary-yellow text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 -rotate-90" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // Game UI
  return (
    <div className="min-h-screen bg-background">
      {/* Theme Toggle - Fixed Position Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Navbar */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
            <div className="flex-1">
              <button
                onClick={() => {
                  if (category) {
                    router.back();
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow transition-colors cursor-pointer text-body-lg"
              >
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                <span>Back</span>
              </button>
            </div>

            {/* Progress - Center */}
            <div className="flex-1 text-center text-text-secondary text-label">
              Question <span className="text-primary-yellow font-bold">{currentIndex + 1}</span> / {sentences.length}
            </div>

            {/* AI Badge - Right */}
            <div className="flex-1 flex items-center justify-end">
              <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-yellow text-black text-label font-bold rounded-lg border-2 border-black">
                AI
              </span>
            </div>
          </div>

          {/* Category & Subcategory Badges */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="inline-block px-2 sm:px-4 py-1 bg-secondary-purple text-white text-label font-semibold rounded-full capitalize">
              {category}
            </span>
            <span className="inline-block px-2 sm:px-4 py-1 bg-primary-yellow text-black text-label font-semibold rounded-full">
              Part {subcategory}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 mt-3 sm:mt-4">
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary-yellow"
            initial={{ width: 0 }}
            animate={{
              width: `${((currentIndex + 1) / sentences.length) * 100}%`,
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4 sm:space-y-8"
          >
            {/* Question - Indonesian Sentence */}
            <div className="bg-card border-2 border-theme rounded-2xl p-4 sm:p-8">
              <p className="text-label font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                Complete the sentence
              </p>
              <p className="text-heading-3 sm:text-heading-1 text-text-primary break-words">
                {renderSentenceWithBadge()}
              </p>
            </div>

            {/* Underscore Display */}
            <div className="bg-card-darker border-2 border-theme rounded-2xl p-4 sm:p-8 text-center">
              <p className="text-lg sm:text-game-display text-text-secondary tracking-wider break-words">
                {renderUnderscoreDisplay()}
              </p>
            </div>

            {/* Input Area */}
            <div className="space-y-3 sm:space-y-4">
              <input
                key={`input-${currentIndex}`}
                type="text"
                value={userAnswer}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type the English translation..."
                autoFocus
                disabled={!!feedback}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-input border-2 border-input rounded-2xl text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-primary-yellow transition-colors disabled:opacity-50 cursor-pointer text-body-sm sm:text-body-lg"
              />

              {/* Buttons */}
              <div className="flex gap-2 sm:gap-4 flex-row w-full">
                <button
                  onClick={handleHintClick}
                  disabled={
                    hintClickCount >=
                      getMaxWordLength(currentSentence.sentence_english) || !!feedback
                  }
                  className="flex-1 py-3 sm:py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer bg-secondary-purple text-white hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-body-xs sm:text-body-lg"
                >
                  <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Hint</span>
                  <span className="text-xs sm:text-sm">({hintClickCount})</span>
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !userAnswer.trim() || !!feedback}
                  className="flex-1 py-3 sm:py-3 rounded-xl font-semibold bg-primary-yellow text-black hover:scale-105 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-body-xs sm:text-body-lg flex items-center justify-center"
                >
                  {feedback
                    ? feedback === 'correct'
                      ? '✓ Correct!'
                      : '✗ Wrong!'
                    : 'Check Answer'}
                </button>
              </div>
            </div>

            {/* Feedback Display */}
            {feedback && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`p-4 sm:p-6 rounded-2xl text-center font-bold flex items-center justify-center gap-3 ${
                  feedback === 'correct'
                    ? 'bg-green-500/20 border-2 border-green-500/50 text-green-400'
                    : 'bg-red-500/20 border-2 border-red-500/50 text-red-400'
                }`}
              >
                {feedback === 'correct' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                    <span className="text-body-sm sm:text-body-lg">Excellent!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                    <span className="text-body-sm sm:text-body-lg">Incorrect</span>
                  </>
                )}
              </motion.div>
            )}

            {/* Correct Answer Display */}
            {feedback && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-card border-2 border-theme rounded-2xl p-4 sm:p-6"
              >
                <p className="text-label text-text-secondary mb-2">Correct Answer:</p>
                <p className="text-heading-3 sm:text-heading-2 text-primary-yellow break-words">
                  {currentSentence.sentence_english}
                </p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
