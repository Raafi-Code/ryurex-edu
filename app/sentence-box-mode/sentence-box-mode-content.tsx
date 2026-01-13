'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowLeft, RotateCcw, Home } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
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
  userAnswer: string;
  questionData?: AiSentenceWord;
}

interface AnswerBox {
  id: string;
  word: string;
  originalIndex: number;
}

export default function SentenceBoxModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const { theme } = useTheme();

  // Game state
  const [sentences, setSentences] = useState<AiSentenceWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerBoxes, setAnswerBoxes] = useState<AnswerBox[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<AnswerBox[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Sentence Game...');
  const [showResultModal, setShowResultModal] = useState(false);
  const [isSubmittingResults, setIsSubmittingResults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset all game state when category or subcategory changes
  useEffect(() => {
    setSentences([]);
    setCurrentIndex(0);
    setAnswerBoxes([]);
    setSelectedAnswer([]);
    setFeedback(null);
    setIsSubmitting(false);
    setGameResults([]);
    setIsLoading(true);
    setShowResultModal(false);
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
        setLoadingMessage('🤖 Generating sentences with AI...');
        console.log('📝 Generating sentences for Sentence Box Mode');

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
        console.log('✅ Generated sentences:', generatedData);

        if (!generatedData.words || generatedData.words.length === 0) {
          throw new Error('No sentences were generated');
        }

        if (isMounted) {
          setSentences(generatedData.words);
          setIsLoading(false);
          console.log(`✅ Loaded ${generatedData.words.length} sentences`);
        }
      } catch (error) {
        console.error('❌ Error loading sentences:', error);
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

  // Initialize answer boxes when sentences load or current index changes
  useEffect(() => {
    if (sentences.length > 0) {
      const currentSentence = sentences[currentIndex];
      const words = currentSentence.sentence_english.split(/\s+/);
      
      // Create answer boxes and shuffle them
      const boxes: AnswerBox[] = words.map((word, idx) => ({
        id: `${currentIndex}-${idx}`,
        word: word,
        originalIndex: idx,
      }));

      // Fisher-Yates shuffle
      for (let i = boxes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [boxes[i], boxes[j]] = [boxes[j], boxes[i]];
      }

      setAnswerBoxes(boxes);
      setSelectedAnswer([]);
      setFeedback(null);
      setIsSubmitting(false);
    }
  }, [currentIndex, sentences]);

  const currentSentence = sentences[currentIndex];

  const handleBoxClick = (box: AnswerBox) => {
    if (feedback) return; // Disable clicking during feedback
    
    // Remove from answer boxes and add to selected
    setAnswerBoxes((prev) => prev.filter((b) => b.id !== box.id));
    setSelectedAnswer((prev) => [...prev, box]);
  };

  const handleRemoveAnswer = (index: number) => {
    if (feedback) return; // Disable clicking during feedback
    
    const removedBox = selectedAnswer[index];
    setSelectedAnswer((prev) => prev.filter((_, i) => i !== index));
    setAnswerBoxes((prev) => [...prev, removedBox].sort((a, b) => a.originalIndex - b.originalIndex));
  };

  const handleClear = () => {
    setAnswerBoxes((prev) => [...prev, ...selectedAnswer].sort((a, b) => a.originalIndex - b.originalIndex));
    setSelectedAnswer([]);
  };

  const handleSubmit = () => {
    if (isSubmitting || selectedAnswer.length === 0) return;

    setIsSubmitting(true);

    const userSentence = selectedAnswer.map((box) => box.word).join(' ');
    const correctSentence = currentSentence.sentence_english;

    // Normalize both sentences for comparison
    const normalizeStr = (str: string) =>
      str.toLowerCase().replace(/[.,!?;:'"]/g, '').trim();

    const isCorrect = normalizeStr(userSentence) === normalizeStr(correctSentence);

    setFeedback(isCorrect ? 'correct' : 'wrong');

    const result: GameResult = {
      vocab_id: currentSentence.id,
      correct: isCorrect,
      userAnswer: userSentence,
      questionData: currentSentence,
    };
    setGameResults((prev) => [...prev, result]);

    setTimeout(() => {
      if (currentIndex < sentences.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        submitAllResults([...gameResults, result]);
      }
    }, 2000);
  };

  const submitAllResults = async (results: GameResult[]) => {
    setIsSubmittingResults(true);
    try {
      console.log('📤 Submitting sentence box mode results:', results);

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
      console.log('✅ Results submitted:', data);

      setShowResultModal(true);
    } catch (error) {
      console.error('❌ Error submitting results:', error);
      alert(`Failed to submit results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingResults(false);
    }
  };

  const handleRetry = () => {
    router.push(
      `/sentence-box-mode?category=${encodeURIComponent(category || '')}&subcategory=${subcategory}`
    );
  };

  const handleBackToCategory = () => {
    router.push(`/category-menu/${encodeURIComponent(category || '')}`);
  };

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  // Helper function to highlight the vocabulary word in the sentence
  const renderSentenceWithBadge = () => {
    const sentence = currentSentence.sentence_indo;
    const vocabWordIndo = currentSentence.indo.toLowerCase();

    const parts = sentence.split(/(\s+|[.,!?;:'"()-])/);

    return parts.map((part, index) => {
      if (!part) return null;

      if (part.toLowerCase() === vocabWordIndo) {
        return (
          <span
            key={index}
            className="inline-block bg-primary-yellow text-black px-2 py-1 rounded font-semibold mx-1"
          >
            {part}
          </span>
        );
      }

      return <span key={index}>{part}</span>;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="spinner-loading"
            />
          </div>
          <p className="text-body-sm sm:text-body-lg text-text-primary font-semibold mb-2">
            {loadingMessage}
          </p>
          <p className="text-body-xs sm:text-body-sm text-text-secondary">
            This may take a moment...
          </p>
        </div>
      </div>
    );
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
              onClick={handleBackToDashboard}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-secondary-purple text-white rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Theme Toggle */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Header */}
      <div className="border-b border-text-secondary/10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
            <div className="flex-1">
              <button
                onClick={handleBackToCategory}
                className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow transition-colors cursor-pointer text-body-lg"
              >
                <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                <span>Back</span>
              </button>
            </div>

            {/* Progress - Center */}
            <div className="flex-1 text-center text-text-secondary text-label">
              Question <span className="text-primary-yellow font-bold">{currentIndex + 1}</span> /{' '}
              {sentences.length}
            </div>

            {/* Mode Badge - Right */}
            <div className="flex-1 flex items-center justify-end">
              <span className="text-xs sm:text-sm px-3 py-1 bg-secondary-purple text-white rounded-full font-semibold">
                Sentence Box
              </span>
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
            animate={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Main Content */}
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
            {/* Indonesian Sentence with Badge */}
            <div className="text-center">
              <p className="text-text-secondary text-label mb-3">Translate this sentence to English:</p>
              <div className="bg-surface px-4 sm:px-8 py-4 sm:py-6 rounded-xl border-2 border-text-secondary/20">
                <p className="text-lg sm:text-xl text-text-primary leading-relaxed">
                  {renderSentenceWithBadge()}
                </p>
              </div>
            </div>

            {/* Answer Area */}
            <div className="bg-surface px-4 sm:px-6 py-6 rounded-xl border-2 border-primary-yellow/30 min-h-24">
              <p className="text-text-secondary text-label mb-4">Your Answer:</p>
              <div className="flex flex-wrap gap-2 mb-4 min-h-12">
                {selectedAnswer.length === 0 ? (
                  <p className="text-text-secondary/60 text-sm italic">Click words below to build your answer</p>
                ) : (
                  selectedAnswer.map((box, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => handleRemoveAnswer(idx)}
                      className="px-3 py-2 bg-primary-yellow text-black rounded-lg font-semibold hover:bg-primary-yellow-hover transition-colors cursor-pointer text-sm sm:text-base"
                    >
                      {box.word}
                    </motion.button>
                  ))
                )}
              </div>

              {/* Clear Button */}
              {selectedAnswer.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-text-secondary hover:text-primary-yellow transition-colors cursor-pointer text-xs sm:text-sm underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Answer Boxes */}
            <div className="space-y-3">
              <p className="text-text-secondary text-label">Available Words:</p>
              <div className="flex flex-wrap gap-2">
                {answerBoxes.map((box) => (
                  <motion.button
                    key={box.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => handleBoxClick(box)}
                    disabled={!!feedback}
                    className={`px-4 py-3 rounded-lg font-semibold transition-all cursor-pointer text-sm sm:text-base ${
                      feedback
                        ? 'opacity-50 cursor-not-allowed'
                        : 'bg-secondary-purple text-white hover:scale-105 hover:shadow-lg'
                    }`}
                  >
                    {box.word}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="text-center pt-4">
              <button
                onClick={handleSubmit}
                disabled={selectedAnswer.length === 0 || isSubmitting || !!feedback}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all cursor-pointer ${
                  selectedAnswer.length === 0 || isSubmitting || feedback
                    ? 'bg-primary-yellow text-black opacity-50 cursor-not-allowed'
                    : 'bg-primary-yellow text-black hover:bg-primary-yellow-hover hover:scale-105'
                }`}
              >
                {isSubmitting ? 'Checking...' : 'Check Answer'}
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
                        <span>Incorrect</span>
                      </>
                    )}
                  </div>
                  <p className="text-text-secondary mt-3 text-lg">
                    Correct answer: {currentSentence.sentence_english}
                  </p>
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
              <div className="flex justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="spinner-loading"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Submitting Results...</h3>
                <p className="text-gray-400 text-sm">Please wait while we save your progress</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <ResultModal
          results={gameResults}
          onRetry={handleRetry}
          onBackToCategory={handleBackToCategory}
          onBackToDashboard={handleBackToDashboard}
        />
      )}
    </div>
  );
}

// Result Modal Component
function ResultModal({
  results,
  onRetry,
  onBackToCategory,
  onBackToDashboard,
}: {
  results: GameResult[];
  onRetry: () => void;
  onBackToCategory: () => void;
  onBackToDashboard: () => void;
}) {
  const { theme } = useTheme();
  const correctCount = results.filter((r) => r.correct).length;
  const accuracy = ((correctCount / results.length) * 100).toFixed(0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 ${
        theme === 'dark' ? 'bg-[#0a0b0e]' : 'bg-white'
      }`}
      onClick={onBackToDashboard}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        onClick={(e) => e.stopPropagation()}
        className={`border-2 border-primary-yellow rounded-3xl p-8 max-w-md w-full shadow-2xl ${
          theme === 'dark' ? 'bg-card-darker' : 'bg-white'
        }`}
      >
        <div className="text-center space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <h2 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              Session Complete!
            </h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              Great job on finishing {results.length} questions
            </p>
          </div>

          {/* Accuracy Card */}
          <div className="bg-primary-yellow rounded-2xl p-6">
            <p className="text-black/70 text-sm font-semibold">Accuracy</p>
            <p className="text-5xl font-bold text-black">{accuracy}%</p>
            <p className="text-black/60 text-sm mt-2">
              {correctCount} of {results.length} correct
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={onRetry}
              className="w-full px-6 py-4 bg-primary-yellow text-black rounded-xl font-bold text-lg hover:bg-primary-yellow-hover transition-colors shadow-lg cursor-pointer"
            >
              Play Again
            </button>
            <button
              onClick={onBackToCategory}
              className={`w-full px-6 py-4 rounded-xl font-bold text-lg border-2 transition-colors hover:border-primary-yellow cursor-pointer ${
                theme === 'dark'
                  ? 'bg-card border-gray-700 text-white'
                  : 'bg-gray-100 border-gray-300 text-black'
              }`}
            >
              Back to Category
            </button>
            <button
              onClick={onBackToDashboard}
              className={`w-full px-6 py-4 rounded-xl font-bold text-lg border-2 transition-colors hover:border-primary-yellow cursor-pointer ${
                theme === 'dark'
                  ? 'bg-card border-gray-700 text-white'
                  : 'bg-gray-100 border-gray-300 text-black'
              }`}
            >
              Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
