'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Lightbulb, ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import LoadingScreen from '@/components/LoadingScreen';
import { useTheme } from '@/context/ThemeContext';

interface Word {
  vocab_id: number;
  indo: string;
  english: string;
  class: string;
  category: string;
  subcategory: number;
  fluency: number;
}

interface GameResult {
  vocab_id: number;
  correct: boolean;
  time_taken: number;
}

export default function ReviewModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get('category');

  // Game state
  const [words, setWords] = useState<Word[]>([]);
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

  // Timer interval
  useEffect(() => {
    if (isLoading || feedback || showResultModal) return; // Pause timer during loading, feedback or result

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, feedback, showResultModal]);

  // Show hint after 10 seconds
  useEffect(() => {
    if (timer >= 10 && !feedback) {
      setShowHint(true);
      // Auto-fill revealed letters when hint appears
      const currentWord = words[currentIndex];
      if (currentWord) {
        const revealedLetters = Math.floor(timer / 10);
        // Build the correct answer with revealed letters
        let filledAnswer = '';
        for (let i = 0; i < currentWord.english.length; i++) {
          if (i < revealedLetters) {
            filledAnswer += currentWord.english[i];
          } else if (userAnswer[i]) {
            filledAnswer += userAnswer[i];
          } else {
            break; // Stop if we hit an empty position
          }
        }
        // Only update if we have revealed letters
        if (revealedLetters > 0) {
          setUserAnswer(filledAnswer);
        }
      }
    }
  }, [timer, feedback, words, currentIndex, userAnswer]);

  // Fetch words on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadWords = async () => {
      try {
        // Build URL with optional category filter
        const url = new URL('/api/getBatch', window.location.origin);
        if (categoryFilter) {
          url.searchParams.append('category', categoryFilter);
        }
        
        const response = await fetch(url.toString());
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch words');
        }
        
        const data = await response.json();
        console.log('📚 Fetched vocab batch:', data);
        console.log(`📊 Total words received: ${data.count}`);
        
        // API returns { success, words, count }
        if (data.words && Array.isArray(data.words)) {
          if (data.words.length === 0) {
            console.log('⚠️ No words available - all words reviewed for today');
            if (isMounted) setWords([]);
          } else {
            if (isMounted) setWords(data.words);
            console.log(`✅ Loaded ${data.words.length} words for practice`);
          }
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
  }, [categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWords = async () => {
    try {
      // Build URL with optional category filter
      const url = new URL('/api/getBatch', window.location.origin);
      if (categoryFilter) {
        url.searchParams.append('category', categoryFilter);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch words');
      }
      
      const data = await response.json();
      console.log('📚 Fetched vocab batch:', data);
      console.log(`📊 Total words received: ${data.count}`);
      
      // API returns { success, words, count }
      if (data.words && Array.isArray(data.words)) {
        if (data.words.length === 0) {
          console.log('⚠️ No words available - all words reviewed for today');
          setWords([]);
        } else {
          setWords(data.words);
          console.log(`✅ Loaded ${data.words.length} words for practice`);
        }
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
    const isCorrect = userAnswer.trim().toLowerCase() === currentWord.english.toLowerCase();

    // Show feedback
    setFeedback(isCorrect ? 'correct' : 'wrong');

    // Record result LOCALLY (no API call yet)
    const result: GameResult = {
      vocab_id: currentWord.vocab_id,
      correct: isCorrect,
      time_taken: timer,
    };
    setGameResults((prev) => [...prev, result]);

    // Auto-next after 2 seconds
    setTimeout(() => {
      if (currentIndex < words.length - 1) {
        // Move to next question
        setCurrentIndex((prev) => prev + 1);
        resetQuestion();
      } else {
        // Game completed - submit all results in batch
        submitAllResults([...gameResults, result]);
      }
    }, 2000);
  };

  const submitAllResults = async (results: GameResult[]) => {
    setIsSubmittingResults(true);
    try {
      console.log('📤 Submitting batch results:', results);
      
      const response = await fetch('/api/submitBatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, mode: 'spaced-repetition' }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit results');
      }

      const data = await response.json();
      console.log('✅ Batch submission success:', data);
      
      // Show result modal after successful submission
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
    
    const correctAnswer = currentWord.english;
    const revealedLetters = showHint ? Math.floor(timer / 10) : 0;
    
    // Remove all spaces from input (spaces are auto-added by system)
    // This works for both physical keyboard and virtual keyboard on mobile
    const prevValue = userAnswer;
    const hasNewSpace = newValue.includes(' ') && !prevValue.includes(' ');
    
    if (hasNewSpace) {
      // Space was added - remove it and check if it should auto-add based on correct answer
      newValue = newValue.replace(/\s+/g, '');
      
      // If the position where space was added should have a space in correct answer, add it back
      if (newValue.length < correctAnswer.length && correctAnswer[newValue.length] === ' ') {
        newValue = newValue + ' ';
      }
    }
    
    // If hint is shown, prevent changing revealed letters
    if (showHint && revealedLetters > 0) {
      // Check if user tried to modify any revealed letters
      for (let i = 0; i < revealedLetters; i++) {
        if (correctAnswer[i] !== ' ' && newValue[i] !== correctAnswer[i]) {
          // Restore the revealed letter
          const corrected = correctAnswer.slice(0, revealedLetters) + newValue.slice(revealedLetters);
          setUserAnswer(corrected.slice(0, correctAnswer.length));
          return;
        }
      }
    }
    
    // Auto-skip spaces: if next character in correct answer is space, add it automatically
    // BUT: Only do this when user is TYPING forward (length increasing), not when deleting
    if (!hasNewSpace && newValue.length < correctAnswer.length && correctAnswer[newValue.length] === ' ' && userAnswer.length < newValue.length) {
      newValue = newValue + ' ';
    }
    
    // Limit input to the length of the correct answer
    if (newValue.length <= correctAnswer.length) {
      setUserAnswer(newValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Prevent spacebar input (spaces are auto-added by system)
    if (e.key === ' ') {
      e.preventDefault();
      return;
    }
    
    // Only allow Enter if answer is complete (same condition as Submit button)
    if (e.key === 'Enter' && !isSubmitting && !feedback) {
      const currentWord = words[currentIndex];
      if (userAnswer.trim() && userAnswer.length === currentWord?.english.length) {
        handleSubmit();
      }
    }
  };

  // Generate underscore display with hint
  const renderUnderscoreDisplay = () => {
    if (!words[currentIndex]) return null;
    
    const correctAnswer = words[currentIndex].english;
    const letters = correctAnswer.split('');
    
    // Calculate how many letters to reveal based on timer (every 10 seconds)
    const revealedLetters = showHint ? Math.floor(timer / 10) : 0;

    return letters.map((letter, idx) => {
      // Preserve spaces between words
      if (letter === ' ') {
        return <span key={idx} className="inline-block w-4"></span>;
      }
      
      // Show CORRECT letters in yellow for revealed positions (always show correct answer for hints)
      if (revealedLetters > idx && showHint) {
        return (
          <span key={idx} className="text-primary-yellow font-bold mx-0.5">
            {correctAnswer[idx]}
          </span>
        );
      }
      
      // Show user's typed input (for non-revealed positions)
      if (userAnswer[idx] && !(revealedLetters > idx && showHint)) {
        return (
          <span key={idx} className="text-text-primary mx-0.5">
            {userAnswer[idx]}
          </span>
        );
      }
      
      // Show underscore for empty positions
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
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Great Job!</h2>
          <p className="text-text-secondary mb-6">
            You&apos;ve reviewed all words due for today. Come back tomorrow for more practice, or check your dashboard for stats!
          </p>
          <button
            onClick={() => {
              if (categoryFilter) {
                router.back();
              } else {
                router.push('/dashboard');
              }
            }}
            className="px-6 py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer"
          >
            {categoryFilter ? 'Back to Category' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div className="min-h-screen bg-background">
      {/* Theme Toggle - Fixed Position Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
            <div className="flex-1">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow transition-colors cursor-pointer text-body-lg"
              >
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                <span>Back</span>
              </button>
            </div>

            {/* Progress - Center */}
            <div className="flex-1 text-center text-text-secondary text-label">
              Question <span className="text-primary-yellow font-bold">{currentIndex + 1}</span> / {words.length}
            </div>

            {/* Timer - Right */}
            <div className="flex-1 flex items-center justify-end gap-1 sm:gap-2 text-text-secondary text-label">
              <Clock className="w-4 sm:w-5 h-4 sm:h-5" />
              <span className="font-mono">{timer}s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-3 sm:px-4 mt-3 sm:mt-4">
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary-yellow"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

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
              <div className="flex items-center justify-center gap-2">
                {currentWord.class && (
                  <span className="inline-block px-3 py-1 bg-primary-yellow text-black text-xs font-semibold rounded-full">
                    {currentWord.class}
                  </span>
                )}
                <span className="inline-block px-3 py-1 bg-secondary-purple text-white text-xs rounded-full">
                  {currentWord.category}
                </span>
              </div>
            </div>

            {/* Interactive Underscore Input */}
            <div className="text-center">
              <div className="relative inline-block">
                {/* Hidden input for capturing keystrokes */}
                <input
                  type="text"
                  value={userAnswer}
                  onChange={handleInputChange}
                  onKeyPress={handleKeyPress}
                  disabled={!!feedback}
                  maxLength={currentWord.english.length}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-default"
                  autoFocus
                  style={{ caretColor: 'transparent' }}
                />
                
                {/* Visual underscore display */}
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
                disabled={
                  !userAnswer.trim() || 
                  userAnswer.length !== words[currentIndex]?.english.length || 
                  isSubmitting || 
                  !!feedback
                }
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
                  className={`text-center py-6 ${
                    feedback === 'correct' ? 'text-green-400' : 'text-red-400'
                  }`}
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
                        <span>Wrong! The answer is: {currentWord.english}</span>
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
            {/* Loading Text with Pulse */}
            <div className="text-center space-y-4">
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-primary-yellow text-heading-3 font-bold"
              >
                Submitting Your Results...
              </motion.p>

              {/* Dots Animation */}
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
        <ResultModal
          results={gameResults}
          onClose={() => router.push('/dashboard')}
          onBackToCategory={() => router.back()}
          onPlayAgain={() => {
            setShowResultModal(false);
            setIsLoading(true);
            setCurrentIndex(0);
            setGameResults([]);
            resetQuestion();
            fetchWords();
          }}
          categoryFilter={categoryFilter}
        />
      )}
    </div>
  );
}

// Result Modal Component
function ResultModal({
  results,
  onClose,
  onBackToCategory,
  onPlayAgain,
  categoryFilter,
}: {
  results: GameResult[];
  onClose: () => void;
  onBackToCategory: () => void;
  onPlayAgain: () => void;
  categoryFilter: string | null;
}) {
  const { theme } = useTheme();
  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = ((correctCount / results.length) * 100).toFixed(0);
  const avgTime = (results.reduce((sum, r) => sum + r.time_taken, 0) / results.length).toFixed(1);
  
  // Calculate XP gained (with bonus for very fast answers)
  const xpGained = results.reduce((sum, r) => {
    if (!r.correct) return sum; // Wrong or reset: 0 XP
    if (r.time_taken <= 5) return sum + 15; // ⚡ Very fast: 15 XP
    if (r.time_taken < 10) return sum + 10; // 🔥 Fast: 10 XP
    return sum; // ⏱️ Slow or reset: 0 XP
  }, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 ${
        theme === 'dark' ? 'bg-[#0a0b0e]' : 'bg-white'
      }`}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        onClick={(e) => e.stopPropagation()}
        className={`border-2 border-primary-yellow rounded-2xl md:rounded-3xl p-4 md:p-8 max-w-64 sm:max-w-sm md:max-w-md w-full shadow-2xl ${
          theme === 'dark' ? 'bg-card-darker' : 'bg-white'
        }`}
      >
        <div className="text-center space-y-3 md:space-y-6">
          {/* Title */}
          <div className="space-y-1 md:space-y-2">
            <h2 className={`text-xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Session Complete!
            </h2>
            <p className={`text-xs md:text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Great job on finishing {results.length} questions
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-3 md:space-y-4">
            {/* XP Gained - Large Card */}
            <div className="bg-primary-yellow rounded-xl md:rounded-2xl p-3 md:p-6">
              <p className="text-black/70 text-xs md:text-sm font-semibold">Total XP Gained</p>
              <p className="text-3xl md:text-5xl font-bold text-black">+{xpGained}</p>
            </div>

            {/* Accuracy & Time Grid */}
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div className={`rounded-lg md:rounded-xl p-2 md:p-4 ${
                theme === 'dark' 
                  ? 'bg-[#2a2b2e] border border-gray-700' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Accuracy
                </p>
                <p className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {accuracy}%
                </p>
                <p className="text-gray-500 text-xs mt-1">{correctCount}/{results.length} correct</p>
              </div>

              <div className={`rounded-lg md:rounded-xl p-2 md:p-4 ${
                theme === 'dark' 
                  ? 'bg-[#2a2b2e] border border-gray-700' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Avg Time
                </p>
                <p className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {avgTime}s
                </p>
                <p className="text-gray-500 text-xs mt-1">per question</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2 md:gap-3 pt-1 md:pt-2">
            <button
              onClick={onPlayAgain}
              className="w-full px-4 md:px-6 py-2 md:py-4 bg-primary-yellow text-black rounded-lg md:rounded-xl font-bold text-sm md:text-lg hover:bg-primary-yellow-hover transition-colors shadow-lg cursor-pointer"
            >
              Play Again
            </button>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {categoryFilter && (
                <button
                  onClick={onBackToCategory}
                  className={`px-3 md:px-6 py-2 md:py-4 rounded-lg md:rounded-xl font-bold text-xs md:text-lg border-2 transition-colors hover:border-primary-yellow cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-card border-gray-700 text-white'
                      : 'bg-gray-100 border-gray-300 text-black'
                  }`}
                >
                  Back to Category
                </button>
              )}
              <button
                onClick={onClose}
                className={`px-3 md:px-6 py-2 md:py-4 rounded-lg md:rounded-xl font-bold text-xs md:text-lg border-2 transition-colors hover:border-primary-yellow cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-card border-gray-700 text-white'
                    : 'bg-gray-100 border-gray-300 text-black'
                }`}
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
