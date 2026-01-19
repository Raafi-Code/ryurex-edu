'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, Lightbulb, ArrowLeft, RotateCcw, ChevronRight, Home } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

interface VocabWord {
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

export default function VocabGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');

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

  // Reset all game state when category or subcategory changes
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

  // Fetch words on mount - REQUIRED category and subcategory
  useEffect(() => {
    if (!category || !subcategory) {
      alert('Category and Subcategory are required!');
      router.push('/dashboard');
      return;
    }
    
    let isMounted = true;
    
    const loadWords = async () => {
      try {
        // Use custom batch endpoint - directly fetch words without "due today" filter
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
        console.log('📚 Fetched custom vocab batch:', data);
        console.log(`📊 Selected: ${data.count} words, Total available: ${data.total_available}`);
        console.log(`🎯 Filter: category=${category}, subcategory=${subcategory}`);
        
        // API returns { success, words, count, total_available }
        if (data.words && Array.isArray(data.words)) {
          if (data.words.length === 0) {
            console.log('⚠️ No words available for this category and subcategory');
            if (isMounted) setWords([]);
          } else {
            if (isMounted) setWords(data.words);
            console.log(`✅ Loaded ${data.words.length} words for custom practice`);
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
  }, [category, subcategory, router]);

  const fetchWords = async () => {
    try {
      if (!category || !subcategory) {
        throw new Error('Category and subcategory are required');
      }

      // Use custom batch endpoint - directly fetch words without "due today" filter
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
      console.log('📚 Fetched custom vocab batch:', data);
      console.log(`📊 Selected: ${data.count} words, Total available: ${data.total_available}`);
      console.log(`🎯 Filter: category=${category}, subcategory=${subcategory}`);
      
      // API returns { success, words, count, total_available }
      if (data.words && Array.isArray(data.words)) {
        if (data.words.length === 0) {
          console.log('⚠️ No words available for this category and subcategory');
          setWords([]);
        } else {
          setWords(data.words);
          console.log(`✅ Loaded ${data.words.length} words for custom practice`);
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
        body: JSON.stringify({ results }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit results');
      }

      const data = await response.json();
      console.log('✅ Batch submission success:', data);
      
      // Check if next part exists before showing modal
      try {
        const nextSubcategory = parseInt(String(subcategory)) + 1;
        const checkResponse = await fetch(`/api/subcategories?category=${encodeURIComponent(category || '')}`);
        
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const nextPartExists = checkData.subcategories?.some(
            (sub: { subcategory: number; word_count: number }) => sub.subcategory === nextSubcategory && sub.word_count > 0
          );
          setHasNextPart(!!nextPartExists);
          console.log('Next part exists:', nextPartExists);
        }
      } catch (error) {
        console.error('Error checking next part:', error);
        setHasNextPart(false);
      }
      
      // Show result modal after checking is complete
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
          <p className="text-text-secondary">Loading vocabulary...</p>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">No Words Available</h2>
          <p className="text-text-secondary mb-6">
            There are no words in &quot;{category}&quot; Part {subcategory} yet. Please try another category or part.
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
                onClick={() => router.push('/dashboard')}
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card-darker border-2 border-primary-yellow rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="text-center space-y-6">
              {/* Spinner */}
              <div className="flex justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="spinner-loading"
                />
              </div>

              {/* Text */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">
                  Submitting Your Results...
                </h3>
                <p className="text-gray-400 text-sm">
                  Please wait while we save your progress
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <ResultModal
          results={gameResults}
          subcategory={subcategory || ''}
          hasNextPart={hasNextPart}
          onClose={() => router.push(`/category-menu/${category}`)}
          onPlayAgain={() => {
            setShowResultModal(false);
            setIsLoading(true);
            setCurrentIndex(0);
            setGameResults([]);
            setHasNextPart(false);
            resetQuestion();
            fetchWords();
          }}
          onNextPart={(nextSubcategory) => {
            setShowResultModal(false);
            setIsLoading(true);
            // Use window.location for full page reload (same as manual click)
            const url = `/vocabgame?category=${encodeURIComponent(category || '')}&subcategory=${nextSubcategory}`;
            window.location.href = url;
          }}
        />
      )}
    </div>
  );
}

// Result Modal Component
function ResultModal({
  results,
  subcategory,
  hasNextPart,
  onClose,
  onPlayAgain,
  onNextPart,
}: {
  results: GameResult[];
  subcategory: string | number;
  hasNextPart: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  onNextPart: (nextSubcategory: number) => void;
}) {

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

  const handleNextPart = () => {
    const nextSubcategory = parseInt(String(subcategory)) + 1;
    onNextPart(nextSubcategory);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50`}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        onClick={(e) => e.stopPropagation()}
        className="border-2 border-primary-yellow rounded-3xl p-8 max-w-md w-full shadow-2xl bg-card-darker"
      >
        <div className="text-center space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">
              Session Complete!
            </h2>
            <p className="text-gray-400">
              Great job on finishing {results.length} questions
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            {/* XP Gained - Large Card */}
            <div className="bg-primary-yellow rounded-2xl p-6">
              <p className="text-black/70 text-sm font-semibold">Total XP Gained</p>
              <p className="text-5xl font-bold text-black">+{xpGained}</p>
            </div>

            {/* Accuracy & Time Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl p-4 bg-card-darker border border-gray-700">
                <p className="text-xs mb-1 text-gray-400">
                  Accuracy
                </p>
                <p className="text-3xl font-bold text-white">
                  {accuracy}%
                </p>
                <p className="text-gray-500 text-xs mt-1">{correctCount}/{results.length} correct</p>
              </div>

              <div className="rounded-xl p-4 bg-card-darker border border-gray-700">
                <p className="text-xs mb-1 text-gray-400">
                  Avg Time
                </p>
                <p className="text-3xl font-bold text-white">
                  {avgTime}s
                </p>
                <p className="text-gray-500 text-xs mt-1">per question</p>
              </div>
            </div>
          </div>

          {/* Buttons - Icon Only */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {/* Play Again */}
            <button
              onClick={onPlayAgain}
              title="Play Again"
              className="p-4 bg-primary-yellow text-black rounded-full hover:bg-primary-yellow-hover hover:scale-110 transition-all shadow-lg cursor-pointer"
            >
              <RotateCcw className="w-6 h-6" />
            </button>

            {/* Next Part */}
            <button
              onClick={() => {
                if (hasNextPart) {
                  handleNextPart();
                }
              }}
              disabled={!hasNextPart}
              title={hasNextPart ? "Next Part" : "No more parts available"}
              className={`p-4 rounded-full border-2 transition-all shadow-lg ${
                hasNextPart
                  ? 'cursor-pointer hover:scale-110 bg-card border-primary-yellow text-primary-yellow hover:bg-primary-yellow/10'
                  : 'cursor-not-allowed opacity-50 bg-card border-gray-600 text-gray-600'
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Back to Menu */}
            <button
              onClick={onClose}
              title="Back to Menu"
              className="p-4 rounded-full border-2 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-all hover:scale-110 shadow-lg cursor-pointer bg-card"
            >
              <Home className="w-6 h-6" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
