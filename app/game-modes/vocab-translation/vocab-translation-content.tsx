'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';
import {
  useAuthCheck,
  GameNavbar,
  ProgressBar,
  GameResultModal,
  calculateAccuracy,
  calculateAvgTime,
  calculateXPGained,
  isAnswerCorrect,
  formatTime,
} from '../shared';

interface VocabWord {
  vocab_id: number;
  indo: string;
  english_primary: string;
  synonyms: string[];
  class: string;
  category: string;
  subcategory: string;
  fluency: number;
}

interface GameResult {
  vocab_id: number;
  correct: boolean;
  time_taken: number;
}

export default function VocabTranslationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const supabase = createClient();

  // Game state
  const [words, setWords] = useState<VocabWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [timer, setTimer] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [hasNextPart, setHasNextPart] = useState(false);

  // Check authentication
  useAuthCheck(supabase);

  // Reset state when category/subcategory changes
  useEffect(() => {
    setWords([]);
    setCurrentIndex(0);
    setUserAnswer('');
    setTimer(0);
    setShowHint(false);
    setFeedback(null);
    setIsSubmitting(false);
    setGameResults([]);
    setIsLoading(true);
    setShowResultModal(false);
    setIsSubmittingResults(false);
  }, [category, subcategory]);

  // Timer interval
  useEffect(() => {
    if (isLoading || feedback || showResultModal) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, feedback, showResultModal]);

  // Show hint after 10 seconds
  useEffect(() => {
    if (timer >= 10 && !feedback) {
      setShowHint(true);
      const currentWord = words[currentIndex];
      if (currentWord) {
        const revealedLetters = Math.floor(timer / 10);
        let filledAnswer = '';
        for (let i = 0; i < currentWord.english_primary.length; i++) {
          if (i < revealedLetters) {
            filledAnswer += currentWord.english_primary[i];
          } else if (userAnswer[i]) {
            filledAnswer += userAnswer[i];
          } else {
            break;
          }
        }
        if (revealedLetters > 0) {
          setUserAnswer(filledAnswer);
        }
      }
    }
  }, [timer, feedback, words, currentIndex, userAnswer]);

  // Fetch words
  useEffect(() => {
    if (!category || !subcategory) {
      alert('Category and Subcategory are required!');
      router.push('/dashboard');
      return;
    }

    let isMounted = true;

    const loadWords = async () => {
      try {
        const params = new URLSearchParams();
        params.append('category', category);
        params.append('subcategory', subcategory);

        const url = `/api/getCustomBatch?${params.toString()}`;

        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch words');
        }

        const data = await response.json();

        if (data.words && Array.isArray(data.words)) {
          if (isMounted) setWords(data.words.length === 0 ? [] : data.words);
        } else {
          throw new Error('Invalid data format from API');
        }

        if (isMounted) setIsLoading(false);
      } catch (error) {
        console.error('❌ Error fetching words:', error);
        if (isMounted) {
          alert(`Failed to load vocabulary: ${error instanceof Error ? error.message : 'Unknown error'}`);
          router.push('/dashboard');
        }
      }
    };

    loadWords();

    return () => {
      isMounted = false;
    };
  }, [category, subcategory, router]);

  const fetchWords = async () => {
    try {
      if (!category || !subcategory) {
        throw new Error('Category and subcategory are required');
      }

      const params = new URLSearchParams();
      params.append('category', category);
      params.append('subcategory', subcategory);

      const url = `/api/getCustomBatch?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch words');
      }

      const data = await response.json();

      if (data.words && Array.isArray(data.words)) {
        setWords(data.words.length === 0 ? [] : data.words);
      } else {
        throw new Error('Invalid data format from API');
      }

      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error fetching words:', error);
      alert(`Failed to load vocabulary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      router.push('/dashboard');
    }
  };

  const handleSubmit = () => {
    if (isSubmitting || !userAnswer.trim()) return;

    setIsSubmitting(true);
    const currentWord = words[currentIndex];
    const isCorrect = isAnswerCorrect(
      userAnswer,
      currentWord.english_primary,
      currentWord.synonyms
    );

    setFeedback(isCorrect ? 'correct' : 'wrong');

    const result: GameResult = {
      vocab_id: currentWord.vocab_id,
      correct: isCorrect,
      time_taken: timer,
    };
    setGameResults((prev) => [...prev, result]);

    setTimeout(() => {
      if (currentIndex < words.length - 1) {
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
      const response = await fetch('/api/submitBatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit results');
      }

      // Check if next part exists
      try {
        const nextSubcategory = parseInt(String(subcategory)) + 1;
        const checkResponse = await fetch(`/api/subcategories?category=${encodeURIComponent(category || '')}`);

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const currentSubcatIndex = checkData.subcategories?.findIndex(
            (sub: { subcategory_name: string }) => sub.subcategory_name === subcategory
          );
          const nextPartExists = currentSubcatIndex !== -1 && currentSubcatIndex < (checkData.subcategories?.length || 0) - 1;
          setHasNextPart(!!nextPartExists);
        }
      } catch (error) {
        console.error('Error checking next part:', error);
        setHasNextPart(false);
      }

      setShowResultModal(true);
    } catch (error) {
      console.error('❌ Error submitting batch results:', error);
      alert('Failed to save your progress. Please try again.');
    } finally {
      setIsSubmittingResults(false);
    }
  };

  const resetQuestion = () => {
    setUserAnswer('');
    setTimer(0);
    setShowHint(false);
    setFeedback(null);
    setIsSubmitting(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    const currentWord = words[currentIndex];

    if (!currentWord) return;

    const correctAnswer = currentWord.english_primary;
    const revealedLetters = showHint ? Math.floor(timer / 10) : 0;

    const prevValue = userAnswer;
    const hasNewSpace = newValue.includes(' ') && !prevValue.includes(' ');

    if (hasNewSpace) {
      newValue = newValue.replace(/\s+/g, '');

      if (newValue.length < correctAnswer.length && correctAnswer[newValue.length] === ' ') {
        newValue = newValue + ' ';
      }
    }

    if (showHint && revealedLetters > 0) {
      for (let i = 0; i < revealedLetters; i++) {
        if (correctAnswer[i] !== ' ' && newValue[i] !== correctAnswer[i]) {
          const corrected = correctAnswer.slice(0, revealedLetters) + newValue.slice(revealedLetters);
          setUserAnswer(corrected.slice(0, correctAnswer.length));
          return;
        }
      }
    }

    if (!hasNewSpace && newValue.length < correctAnswer.length && correctAnswer[newValue.length] === ' ' && userAnswer.length < newValue.length) {
      newValue = newValue + ' ';
    }

    if (newValue.length <= correctAnswer.length) {
      setUserAnswer(newValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      return;
    }

    if (e.key === 'Enter' && !isSubmitting && !feedback) {
      const currentWord = words[currentIndex];
      if (userAnswer.trim() && userAnswer.length >= 1) {
        handleSubmit();
      }
    }
  };

  const renderUnderscoreDisplay = () => {
    if (!words[currentIndex]) return null;

    const correctAnswer = words[currentIndex].english_primary;
    const letters = correctAnswer.split('');
    const revealedLetters = showHint ? Math.floor(timer / 10) : 0;

    return letters.map((letter, idx) => {
      if (letter === ' ') {
        return <span key={idx} className="inline-block w-4"></span>;
      }

      if (revealedLetters > idx && showHint) {
        return (
          <span key={idx} className="text-primary-yellow font-bold mx-0.5">
            {correctAnswer[idx]}
          </span>
        );
      }

      if (userAnswer[idx] && !(revealedLetters > idx && showHint)) {
        return (
          <span key={idx} className="text-text-primary mx-0.5">
            {userAnswer[idx]}
          </span>
        );
      }

      return (
        <span key={idx} className="text-text-secondary mx-0.5">
          _
        </span>
      );
    });
  };

  if (isLoading) {
    return <LoadingScreen title="Loading vocabulary..." />;
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">No Words Available</h2>
          <p className="text-text-secondary mb-6">
            There are no words in &quot;{category}&quot; Topic &quot;{subcategory}&quot; yet. Please try another category or topic.
          </p>
          <button
            onClick={() => router.push(`/category-menu/${category}`)}
            className="px-6 py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div className="min-h-screen bg-background">
      <GameNavbar
        currentIndex={currentIndex}
        totalQuestions={words.length}
        timer={timer}
        category={category || ''}
        subcategory={subcategory || ''}
        onBack={() => router.push(`/category-menu/${category}`)}
      />

      <ProgressBar current={currentIndex} total={words.length} />

      {/* Main Game Area */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Question */}
            <div className="text-center">
              <p className="text-text-secondary text-label mb-2">Translate this word to English:</p>
              <h1 className="text-heading-1 text-text-primary mb-2">{currentWord.indo}</h1>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {currentWord.class && (
                  <span className="inline-block px-3 py-1 bg-primary-yellow text-black text-xs font-semibold rounded-full">
                    {currentWord.class}
                  </span>
                )}
                {currentWord.category && (
                  <span className="inline-block px-3 py-1 bg-secondary-purple text-white text-xs rounded-full">
                    {currentWord.category}
                  </span>
                )}
                {currentWord.subcategory && (
                  <span className="inline-block px-3 py-1 bg-blue-500/80 text-white text-xs rounded-full">
                    {currentWord.subcategory}
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Underscore Input */}
            <div className="text-center">
              <div className="relative inline-block">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={!!feedback}
                  maxLength={currentWord.english_primary.length}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-default"
                  autoFocus
                  style={{ caretColor: 'transparent' }}
                />

                <div
                  className="bg-surface px-4 sm:px-8 py-4 sm:py-6 rounded-xl border-2 border-text-secondary/20 hover:border-primary-yellow/50 transition-colors cursor-text"
                  onClick={() => {
                    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (input) input.focus();
                  }}
                >
                  <p className="text-2xl sm:text-3xl md:text-4xl font-mono tracking-widest select-none">
                    {renderUnderscoreDisplay()}
                  </p>
                </div>
              </div>
            </div>

            {/* Hint Indicator */}
            {showHint && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 text-primary-yellow"
              >
                <Lightbulb className="w-5 h-5" />
                <span className="text-sm">Hint: First letter revealed!</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <div className="text-center">
              <button
                onClick={handleSubmit}
                disabled={!userAnswer.trim() || isSubmitting || !!feedback}
                className="w-32 sm:w-40 py-3 sm:py-4 bg-primary-yellow text-black rounded-xl font-bold text-base sm:text-lg hover:bg-primary-yellow-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? 'Checking...' : 'Submit'}
              </button>
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`text-center py-6 ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}
                >
                  <div className="flex items-center justify-center gap-3 text-2xl font-bold">
                    {feedback === 'correct' ? (
                      <>
                        <CheckCircle2 className="w-8 h-8" />
                        <span>Correct!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-8 h-8" />
                        <span>Wrong! The answer is: {currentWord.english_primary}</span>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

      {/* Result Modal */}
      {showResultModal && (
        <GameResultModal
          correctCount={gameResults.filter((r) => r.correct).length}
          totalCount={gameResults.length}
          accuracy={calculateAccuracy(gameResults.length, gameResults.filter((r) => r.correct).length)}
          avgTime={calculateAvgTime(
            gameResults.reduce((sum, r) => sum + r.time_taken, 0),
            gameResults.length
          )}
          totalTime={Math.floor(gameResults.reduce((sum, r) => sum + r.time_taken, 0))}
          xpGained={calculateXPGained(gameResults)}
          onPlayAgain={() => {
            setShowResultModal(false);
            setIsLoading(true);
            setCurrentIndex(0);
            setGameResults([]);
            setHasNextPart(false);
            resetQuestion();
            fetchWords();
          }}
          onBackToMenu={() => router.push(`/category-menu/${category}`)}
          onNextPart={() => {
            setShowResultModal(false);
            setIsLoading(true);
            const nextSubcategoryIndex = parseInt(String(subcategory)) + 1;
            const url = `/game-modes/vocab-translation?category=${encodeURIComponent(category || '')}&subcategory=${nextSubcategoryIndex}`;
            window.location.href = url;
          }}
          hasNextPart={hasNextPart}
          showPlayAgain={true}
          showNextPart={true}
        />
      )}
    </div>
  );
}
