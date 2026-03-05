'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, RotateCcw, Home, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';
import { useTheme } from '@/context/ThemeContext';
import {
  useAuthCheck,
  GameNavbar,
  ProgressBar,
  FeedbackSubmitButton,
  calculateAccuracy,
  calculateAvgTime,
  calculateXPGained,
  normalizeString,
} from '../shared';

interface AiSentenceWord {
  id: number;
  indo: string;
  english_primary: string;
  synonyms: string[];
  class: string;
  category: string;
  subcategory: string;
  sentence_indo: string;
  sentence_english: string;
}

interface GameResult {
  vocab_id: number;
  correct: boolean;
  hintClickCount: number;
  userAnswer: string;
  questionData?: AiSentenceWord;
}

export default function AiSentenceCompletionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const supabase = createClient();
  const { theme } = useTheme();

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
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useAuthCheck(supabase);

  // Reset state
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

  // Fetch AI sentences
  useEffect(() => {
    if (!category || !subcategory) {
      alert('Category and Subcategory are required!');
      router.push('/dashboard');
      return;
    }

    let isMounted = true;

    const loadAiSentences = async () => {
      try {
        setLoadingMessage('Generating Indonesian sentences with AI...');

        const generateResponse = await fetch('/api/ai/generateSentences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, subcategory }),
        });

        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.error || 'Failed to generate sentences');
        }

        const generatedData = await generateResponse.json();

        if (!generatedData.words || generatedData.words.length === 0) {
          throw new Error('No sentences were generated');
        }

        if (isMounted) {
          setSentences(generatedData.words);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('❌ Error loading AI sentences:', error);
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
    const maxLength = Math.max(...words.map((word) => word.replace(/[^a-zA-Z]/g, '').length));
    return maxLength;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserAnswer(e.target.value);
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

            const userWords = userAnswer.trim().split(/\s+/).filter((w) => w.length > 0);
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

  const renderSentenceWithBadge = () => {
    const sentence = currentSentence.sentence_indo;
    const target = currentSentence.indo.toLowerCase().trim();
    const result: React.ReactNode[] = [];
    let remaining = sentence;
    let keyIdx = 0;

    while (remaining.length > 0) {
      const lowerRemaining = remaining.toLowerCase();
      const matchIndex = lowerRemaining.indexOf(target);

      if (matchIndex === -1) {
        result.push(<span key={keyIdx++}>{remaining}</span>);
        break;
      }

      if (matchIndex > 0) {
        result.push(<span key={keyIdx++}>{remaining.slice(0, matchIndex)}</span>);
      }

      result.push(
        <span key={keyIdx++} className="inline-block bg-primary-yellow text-black px-2 py-1 rounded font-semibold mx-1">
          {remaining.slice(matchIndex, matchIndex + target.length)}
        </span>
      );

      remaining = remaining.slice(matchIndex + target.length);
    }

    return result;
  };

  const handleSubmit = () => {
    if (isSubmitting || !userAnswer.trim() || userAnswer.trim().split(/\s+/).length < currentSentence.sentence_english.trim().split(/\s+/).length) return;

    setIsSubmitting(true);

    const userWords = userAnswer.trim().split(/\s+/).map((w) => normalizeString(w));
    const correctWords = currentSentence.sentence_english
      .trim()
      .split(/\s+/)
      .map((w) => normalizeString(w));

    const isCorrect =
      userWords.length === correctWords.length &&
      userWords.every((word, idx) => word === correctWords[idx]);

    setFeedback(isCorrect ? 'correct' : 'wrong');

    const result: GameResult = {
      vocab_id: currentSentence.id,
      correct: isCorrect,
      hintClickCount,
      userAnswer: userAnswer.trim(),
      questionData: currentSentence,
    };
    setGameResults((prev) => [...prev, result]);

    if (isCorrect) {
      // Auto-advance after 2 seconds for correct answers
      setTimeout(() => {
        if (currentIndex < sentences.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          resetQuestion();
        } else {
          submitAllResults([...gameResults, result]);
        }
      }, 2000);
    }
    // Wrong answers: user must click "Next" manually
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetQuestion();
    } else {
      submitAllResults([...gameResults]);
    }
  };

  const submitAllResults = async (results: GameResult[]) => {
    setIsSubmittingResults(true);
    try {
      const response = await fetch('/api/ai/submitScore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, category, subcategory }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit results');
      }

      setShowResultModal(true);
    } catch (error) {
      console.error('❌ Error submitting results:', error);
      alert(`Failed to submit results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingResults(false);
    }
  };

  // Loading state
  if (isLoading) {
    return <LoadingScreen title={loadingMessage} />;
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-body-sm sm:text-body-lg text-text-secondary mb-4">❌ {error}</p>
          <div className="flex gap-2 sm:gap-3 justify-center flex-col sm:flex-row">
            <button
              onClick={() => router.push(`/game-modes/ai-sentence-completion?category=${encodeURIComponent(category || '')}&subcategory=${subcategory}`)}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
            >
              Try Again
            </button>
            <button
              onClick={() => router.back()}
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
            onClick={() => router.back()}
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
    const accuracy = gameResults.length > 0 ? Math.round((correctCount / gameResults.length) * 100) : 0;
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
                Back
              </button>
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
                <p className="text-heading-3 font-bold text-text-primary">N/A</p>
              </div>
              <div className="bg-black/10 dark:bg-white/10 rounded-xl p-3 sm:p-4">
                <p className="text-label text-text-secondary mb-1">Avg Time</p>
                <p className="text-heading-3 font-bold text-text-primary">N/A</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 sm:gap-3">
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => router.push(`/game-modes/ai-sentence-completion?category=${encodeURIComponent(category || '')}&subcategory=${subcategory}`)}
                  className="flex-1 py-3 sm:py-4 rounded-2xl font-bold text-body-sm sm:text-body-lg text-white bg-secondary-purple hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                  Play Again
                </button>

                <button
                  onClick={() => router.back()}
                  className="flex-1 py-3 sm:py-4 rounded-2xl font-bold text-body-sm sm:text-body-lg text-white bg-black border-2 border-primary-yellow hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Back
                </button>
              </div>

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

          {/* Review Section */}
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

                  {/* Carousel */}
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
                          let originalQuestion = wrongResult.questionData || sentences.find((s) => s.id === wrongResult.vocab_id);

                          if (!originalQuestion) {
                            return (
                              <div className="text-center py-8">
                                <p className="text-text-secondary">Question data not found</p>
                              </div>
                            );
                          }

                          return (
                            <div>
                              <p className="text-body-sm sm:text-body-lg text-text-primary font-medium mb-4 leading-relaxed">
                                {originalQuestion.sentence_indo}
                              </p>

                              <div className="mb-4 flex items-center gap-2 flex-wrap">
                                <p className="text-label text-text-secondary font-medium">Vocabulary:</p>
                                <span className="inline-block bg-primary-yellow text-black px-3 py-1 rounded font-semibold text-body-sm">
                                  {originalQuestion.indo}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                <div className="bg-orange-100 dark:bg-orange-950 rounded-lg p-3 sm:p-4 border-l-3 border-orange-500">
                                  <p className="text-label text-orange-700 dark:text-orange-400 font-bold uppercase mb-1">Your Answer</p>
                                  <p className="text-body-sm text-orange-900 dark:text-orange-300 break-words font-mono">
                                    {wrongResult.userAnswer || '(empty)'}
                                  </p>
                                </div>

                                <div className="bg-green-100 dark:bg-green-950 rounded-lg p-3 sm:p-4 border-l-3 border-green-500">
                                  <p className="text-label text-green-700 dark:text-green-400 font-bold uppercase mb-1">Correct Answer</p>
                                  <p className="text-body-sm text-green-900 dark:text-green-300 break-words font-mono">
                                    {originalQuestion.sentence_english}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between gap-4 mt-6">
                      <button
                        onClick={() => setReviewIndex((prev) => (prev === 0 ? wrongAnswers.length - 1 : prev - 1))}
                        disabled={wrongAnswers.length <= 1}
                        className="flex-shrink-0 p-2 sm:p-3 rounded-lg bg-primary-yellow text-black hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 rotate-90" />
                      </button>

                      <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
                        {wrongAnswers.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setReviewIndex(idx)}
                            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all cursor-pointer ${
                              idx === reviewIndex ? 'bg-primary-yellow w-6 sm:w-8' : 'bg-text-secondary/30 hover:bg-text-secondary/50'
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
      <GameNavbar
        currentIndex={currentIndex}
        totalQuestions={sentences.length}
        category={category || ''}
        subcategory={subcategory || ''}
        modeName="AI"
        onBack={() => {
          if (category) {
            router.back();
          } else {
            router.push('/dashboard');
          }
        }}
      />

      <ProgressBar current={currentIndex} total={sentences.length} />

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
            {/* Badges */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
                {currentSentence.class && (
                  <span className="inline-block px-3 py-1 bg-primary-yellow text-black text-xs font-semibold rounded-full">
                    {currentSentence.class}
                  </span>
                )}
                {currentSentence.category && (
                  <span className="inline-block px-3 py-1 bg-secondary-purple text-white text-xs rounded-full">
                    {currentSentence.category}
                  </span>
                )}
                {currentSentence.subcategory && (
                  <span className="inline-block px-3 py-1 bg-blue-500/80 text-white text-xs rounded-full">
                    {currentSentence.subcategory}
                  </span>
                )}
              </div>
            </div>

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
                  disabled={hintClickCount >= getMaxWordLength(currentSentence.sentence_english) || !!feedback}
                  className="flex-1 py-3 sm:py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer bg-secondary-purple text-white hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-body-xs sm:text-body-lg"
                >
                  <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Hint</span>
                  <span className="text-xs sm:text-sm">({hintClickCount})</span>
                </button>
              </div>
            </div>

            {/* Submit + Feedback */}
            <FeedbackSubmitButton
              onSubmit={handleSubmit}
              onNext={handleNext}
              disabled={!userAnswer.trim() || userAnswer.trim().split(/\s+/).length < currentSentence.sentence_english.trim().split(/\s+/).length}
              isSubmitting={isSubmitting}
              feedback={feedback}
              correctAnswer={currentSentence.sentence_english}
              submitLabel="Check Answer"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Loading Submission Modal */}
      {isSubmittingResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="text-center space-y-4">
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-primary-yellow text-heading-3 font-bold"
              >
                Submitting Your Results...
              </motion.p>

              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [-8, 0, -8] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                    className="w-2 h-2 rounded-full bg-primary-yellow"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
