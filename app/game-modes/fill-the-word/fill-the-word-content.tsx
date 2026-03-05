'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Lightbulb, ChevronRight } from 'lucide-react';
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
  normalizeString,
  formatTime,
} from '../shared';

interface FillWord {
  vocab_id: number;
  indo: string;
  english_primary: string;
  synonyms: string[];
  class: string;
  category: string;
  subcategory: string;
  fluency: number;
  sentence_indo: string;
  sentence_english: string;
  blank_answer: string;
  explanation: string | null;
}

interface GameResult {
  vocab_id: number;
  correct: boolean;
  time_taken: number;
}

export default function FillTheWordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  // Game state
  const [words, setWords] = useState<FillWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [timer, setTimer] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [hasNextPart, setHasNextPart] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [nextSubcategoryName, setNextSubcategoryName] = useState<string>('');

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
    setIsGenerating(false);
    setShowResultModal(false);
    setIsSubmittingResults(false);
  }, [category, subcategory]);

  // Timer interval
  useEffect(() => {
    if (isLoading || isGenerating || feedback || showResultModal) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, isGenerating, feedback, showResultModal]);

  // Show hint after 10 seconds — reveal letters progressively
  useEffect(() => {
    if (timer >= 10 && !feedback) {
      setShowHint(true);
      const currentWord = words[currentIndex];
      if (currentWord) {
        const revealedLetters = Math.floor(timer / 10);
        let filledAnswer = '';
        for (let i = 0; i < currentWord.blank_answer.length; i++) {
          if (i < revealedLetters) {
            filledAnswer += currentWord.blank_answer[i];
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
        setIsGenerating(true);
        const params = new URLSearchParams();
        params.append('category', category);
        params.append('subcategory', subcategory);

        const url = `/api/fill-the-word/batch?${params.toString()}`;

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

        if (isMounted) {
          setIsLoading(false);
          setIsGenerating(false);
        }
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

  const fetchWords = useCallback(async () => {
    try {
      if (!category || !subcategory) {
        throw new Error('Category and subcategory are required');
      }

      setIsGenerating(true);
      const params = new URLSearchParams();
      params.append('category', category);
      params.append('subcategory', subcategory);

      const url = `/api/fill-the-word/batch?${params.toString()}`;

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
      setIsGenerating(false);
    } catch (error) {
      console.error('❌ Error fetching words:', error);
      alert(`Failed to load vocabulary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      router.push('/dashboard');
    }
  }, [category, subcategory, router]);

  const handleSubmit = () => {
    if (isSubmitting || !userAnswer.trim()) return;

    setIsSubmitting(true);
    const currentWord = words[currentIndex];

    // Check answer: accept blank_answer OR english_primary
    const normalizedUser = normalizeString(userAnswer);
    const normalizedBlank = normalizeString(currentWord.blank_answer);
    const normalizedPrimary = normalizeString(currentWord.english_primary);

    const isCorrect = normalizedUser === normalizedBlank || normalizedUser === normalizedPrimary;

    setFeedback(isCorrect ? 'correct' : 'wrong');
    setIsSubmitting(false); // Checking is done, reset submitting state

    const result: GameResult = {
      vocab_id: currentWord.vocab_id,
      correct: isCorrect,
      time_taken: timer,
    };
    setGameResults((prev) => [...prev, result]);

    if (isCorrect) {
      // Auto-advance after 2 seconds for correct answers
      setTimeout(() => {
        if (currentIndex < words.length - 1) {
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
    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      resetQuestion();
    } else {
      submitAllResults([...gameResults]);
    }
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
        const checkResponse = await fetch(`/api/subcategories?category=${encodeURIComponent(category || '')}`);

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const currentSubcatIndex = checkData.subcategories?.findIndex(
            (sub: { subcategory_name: string }) => sub.subcategory_name === subcategory
          );
          const nextPartExists = currentSubcatIndex !== -1 && currentSubcatIndex < (checkData.subcategories?.length || 0) - 1;
          setHasNextPart(!!nextPartExists);
          
          // Store next subcategory name if it exists
          if (nextPartExists && checkData.subcategories) {
            setNextSubcategoryName(checkData.subcategories[currentSubcatIndex + 1].subcategory_name);
          }
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
    setShowExplanation(false);
    // Focus input after reset
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    const currentWord = words[currentIndex];

    if (!currentWord) return;

    const correctAnswer = currentWord.blank_answer;
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

    if (e.key === 'Enter') {
      if (feedback === 'wrong') {
        handleNext();
        return;
      }
      if (!isSubmitting && !feedback && userAnswer.trim() && userAnswer.length >= 1) {
        handleSubmit();
      }
    }
  };

  // Render the Indonesian sentence with the target word highlighted
  const renderSentenceWithBadge = (sentence: string, targetWord: string) => {
    // Split by whitespace and punctuation, preserving separators
    const parts = sentence.split(/(\s+|[.,!?;:'"()-])/);

    return parts.map((part, idx) => {
      const cleanPart = part.replace(/[.,!?;:'"()-]/g, '').toLowerCase().trim();
      if (cleanPart === targetWord.toLowerCase().trim()) {
        return (
          <span
            key={idx}
            className="bg-primary-yellow text-black px-2 py-1 rounded font-semibold mx-0.5"
          >
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  // Render the English sentence with the blank word replaced by underscore input
  const renderSentenceWithBlank = () => {
    if (!words[currentIndex]) return null;

    const currentWord = words[currentIndex];
    const sentence = currentWord.sentence_english;
    const blankAnswer = currentWord.blank_answer;

    // Find the blank_answer in the sentence and split around it
    const blankRegex = new RegExp(`\\b${escapeRegExp(blankAnswer)}\\b`, 'i');
    const match = sentence.match(blankRegex);

    if (!match || match.index === undefined) {
      // Fallback: show whole sentence with a generic blank
      return (
        <span className="text-text-primary text-lg sm:text-xl leading-relaxed">
          {sentence}
        </span>
      );
    }

    const beforeBlank = sentence.slice(0, match.index);
    const afterBlank = sentence.slice(match.index + match[0].length);

    return (
      <span className="text-text-primary text-lg sm:text-xl md:text-2xl leading-relaxed">
        {beforeBlank && <span>{beforeBlank}</span>}
        <span className="inline-block align-middle mx-1">
          {renderUnderscoreDisplay()}
        </span>
        {afterBlank && <span>{afterBlank}</span>}
      </span>
    );
  };

  const renderUnderscoreDisplay = () => {
    if (!words[currentIndex]) return null;

    const correctAnswer = words[currentIndex].blank_answer;
    const letters = correctAnswer.split('');
    const revealedLetters = showHint ? Math.floor(timer / 10) : 0;

    return (
      <span className="font-mono tracking-widest">
        {letters.map((letter, idx) => {
          if (letter === ' ') {
            return <span key={idx} className="inline-block w-3"></span>;
          }

          if (revealedLetters > idx && showHint) {
            return (
              <span key={idx} className="text-primary-yellow font-bold mx-0.25">
                {correctAnswer[idx]}
              </span>
            );
          }

          if (userAnswer[idx] && !(revealedLetters > idx && showHint)) {
            return (
              <span key={idx} className="text-text-primary mx-0.25">
                {userAnswer[idx]}
              </span>
            );
          }

          return (
            <span key={idx} className="text-text-secondary mx-0.25">
              _
            </span>
          );
        })}
      </span>
    );
  };

  if (isLoading || isGenerating) {
    return (
      <LoadingScreen
        title={isGenerating ? 'Generating sentences...' : 'Loading vocabulary...'}
      />
    );
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📝</div>
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
        modeName="Fill the Word"
        onBack={() => {
          if (category) {
            router.back();
          } else {
            router.push('/dashboard');
          }
        }}
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
            className="space-y-6 sm:space-y-8"
          >
            {/* Instruction */}
            <div className="text-center">
              <p className="text-text-secondary text-label mb-3">Fill the blank word in the sentence:</p>

              {/* Word class badge */}
              <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
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

            {/* Indonesian Sentence with highlighted target word */}
            <div className="text-center">
              <div className="bg-surface rounded-xl border-2 border-primary-yellow/30 px-4 sm:px-6 py-4 sm:py-5 inline-block max-w-full">
                <p className="text-lg sm:text-xl md:text-2xl text-text-primary leading-relaxed">
                  {renderSentenceWithBadge(currentWord.sentence_indo, currentWord.indo)}
                </p>
              </div>
            </div>

            {/* English Sentence with blank (underscore input) */}
            <div className="text-center">
              <div className="relative inline-block max-w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={userAnswer}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  disabled={!!feedback}
                  maxLength={currentWord.blank_answer.length}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-default"
                  autoFocus
                  style={{ caretColor: 'transparent' }}
                />

                <div
                  className="bg-surface px-4 sm:px-6 py-4 sm:py-5 rounded-xl border-2 border-text-secondary/20 hover:border-primary-yellow/50 transition-colors cursor-text"
                  onClick={() => inputRef.current?.focus()}
                >
                  <p className="leading-relaxed select-none">
                    {renderSentenceWithBlank()}
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
                <span className="text-sm">Hint: Letters being revealed!</span>
              </motion.div>
            )}

            {/* Submit Button - Shows Status Inline */}
            <div className="text-center">
              <button
                onClick={handleSubmit}
                disabled={!userAnswer.trim() || isSubmitting || !!feedback}
                className={`w-32 sm:w-40 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all cursor-pointer ${
                  feedback === 'correct'
                    ? 'bg-green-500 text-white'
                    : feedback === 'wrong'
                      ? 'bg-red-500 text-white'
                      : 'bg-primary-yellow text-black hover:bg-primary-yellow-hover disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {feedback === 'correct' ? 'Correct!' : feedback === 'wrong' ? 'Wrong!' : isSubmitting ? 'Checking...' : 'Submit'}
              </button>
            </div>

            {/* Feedback - Only show for wrong answers */}
            <AnimatePresence>
              {feedback === 'wrong' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  {/* Show correct answer */}
                  <div className="mb-6 text-base sm:text-lg font-medium text-text-secondary">
                    Correct answer: <span className="text-primary-yellow font-bold">{currentWord.blank_answer}</span>
                  </div>

                  {/* Buttons: Centered side-by-side */}
                  <div className="flex items-center justify-center gap-4 mb-4">
                    {currentWord.explanation && (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        onClick={() => setShowExplanation(!showExplanation)}
                        className="px-4 py-2 bg-secondary-purple text-white rounded-lg font-semibold hover:bg-secondary-purple/80 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
                      >
                        <Lightbulb className="w-4 h-4" />
                        <span>{showExplanation ? 'Hide' : 'Show'} Explanation</span>
                      </motion.button>
                    )}
                    
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      onClick={handleNext}
                      className="px-4 py-2 bg-primary-yellow text-black rounded-lg font-semibold hover:bg-primary-yellow-hover transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Explanation - Toggle display */}
                  <AnimatePresence>
                    {showExplanation && currentWord.explanation && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="max-w-lg mx-auto bg-surface border border-text-secondary/20 rounded-lg px-4 py-3"
                      >
                        <p className="text-sm text-text-secondary italic">
                          💡 {currentWord.explanation}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
            setShowExplanation(false);
            resetQuestion();
            fetchWords();
          }}
          onBackToMenu={() => router.push(`/category-menu/${category}`)}
          onNextPart={() => {
            setShowResultModal(false);
            setIsLoading(true);
            const url = `/game-modes/fill-the-word?category=${encodeURIComponent(category || '')}&subcategory=${encodeURIComponent(nextSubcategoryName)}`;
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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
