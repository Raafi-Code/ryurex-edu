'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, RotateCcw, Home } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LoadingScreen from '@/components/LoadingScreen';
import { useTheme } from '@/context/ThemeContext';
import {
  useAuthCheck,
  GameNavbar,
  ProgressBar,
  calculateAccuracy,
  fisherYatesShuffle,
  normalizeString,
} from '../shared';

interface AiSentenceWord {
  id: number;
  indo: string;
  english: string;
  class: string;
  category: string;
  subcategory: string;
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

export default function SentenceOrderingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get('category');
  const subcategory = searchParams.get('subcategory');
  const supabase = createClient();
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

  // Check authentication
  useAuthCheck(supabase);

  // Reset state
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
        setLoadingMessage('Generating sentences with AI...');

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
        console.error('❌ Error loading sentences:', error);
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

  // Initialize answer boxes
  useEffect(() => {
    if (sentences.length > 0) {
      const currentSentence = sentences[currentIndex];
      const words = currentSentence.sentence_english.split(/\s+/);

      const boxes: AnswerBox[] = words.map((word, idx) => ({
        id: `${currentIndex}-${idx}`,
        word: word,
        originalIndex: idx,
      }));

      const shuffledBoxes = fisherYatesShuffle(boxes);

      setAnswerBoxes(shuffledBoxes);
      setSelectedAnswer([]);
      setFeedback(null);
      setIsSubmitting(false);
    }
  }, [currentIndex, sentences]);

  const currentSentence = sentences[currentIndex];

  const handleBoxClick = (box: AnswerBox) => {
    if (feedback) return;

    setAnswerBoxes((prev) => prev.filter((b) => b.id !== box.id));
    setSelectedAnswer((prev) => [...prev, box]);
  };

  const handleRemoveAnswer = (index: number) => {
    if (feedback) return;

    const removedBox = selectedAnswer[index];
    setSelectedAnswer((prev) => prev.filter((_, i) => i !== index));
    setAnswerBoxes((prev) => [...prev, removedBox].sort((a, b) => a.originalIndex - b.originalIndex));
  };

  const handleClear = () => {
    const boxes = [...answerBoxes, ...selectedAnswer];
    const shuffledBoxes = fisherYatesShuffle(boxes);

    setAnswerBoxes(shuffledBoxes);
    setSelectedAnswer([]);
  };

  const handleSubmit = () => {
    if (isSubmitting || selectedAnswer.length === 0) return;

    setIsSubmitting(true);

    const userSentence = selectedAnswer.map((box) => box.word).join(' ');
    const correctSentence = currentSentence.sentence_english;

    const isCorrect = normalizeString(userSentence) === normalizeString(correctSentence);

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
      const response = await fetch('/api/ai/submitScore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results,
          category,
          subcategory: subcategory || '',
        }),
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
              onClick={() =>
                router.push(
                  `/game-modes/sentence-ordering?category=${encodeURIComponent(category || '')}&subcategory=${subcategory}`
                )
              }
              className="px-4 sm:px-6 py-2 sm:py-3 bg-primary-yellow text-black rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-secondary-purple text-white rounded-lg font-semibold hover:scale-105 transition-transform cursor-pointer text-body-sm sm:text-body-lg"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result modal
  if (showResultModal) {
    const correctCount = gameResults.filter((r) => r.correct).length;
    const accuracy = ((correctCount / gameResults.length) * 100).toFixed(0);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`fixed inset-0 flex items-center justify-center p-4 z-50 ${
          theme === 'dark' ? 'bg-[#0a0b0e]' : 'bg-white'
        }`}
        onClick={() => router.push('/dashboard')}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          onClick={(e) => e.stopPropagation()}
          className={`border-2 border-primary-yellow rounded-3xl p-4 md:p-8 max-w-sm sm:max-w-md md:max-w-lg w-full shadow-2xl ${
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
                Great job on finishing {gameResults.length} questions
              </p>
            </div>

            {/* Accuracy Card */}
            <div className="bg-primary-yellow rounded-2xl p-6">
              <p className="text-black/70 text-sm font-semibold">Accuracy</p>
              <p className="text-5xl font-bold text-black">{accuracy}%</p>
              <p className="text-black/60 text-sm mt-2">
                {correctCount} of {gameResults.length} correct
              </p>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() =>
                  router.push(
                    `/game-modes/sentence-ordering?category=${encodeURIComponent(category || '')}&subcategory=${subcategory}`
                  )
                }
                className="w-full px-6 py-4 bg-primary-yellow text-black rounded-xl font-bold text-lg hover:bg-primary-yellow-hover transition-colors shadow-lg cursor-pointer"
              >
                Play Again
              </button>
              <button
                onClick={() => router.back()}
                className={`w-full px-6 py-4 rounded-xl font-bold text-lg border-2 transition-colors hover:border-primary-yellow cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-card border-gray-700 text-white'
                    : 'bg-gray-100 border-gray-300 text-black'
                }`}
              >
                Back to Category
              </button>
              <button
                onClick={() => router.push('/dashboard')}
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

  // Game UI
  return (
    <div className="min-h-screen bg-background">
      <GameNavbar
        currentIndex={currentIndex}
        totalQuestions={sentences.length}
        category={category || ''}
        subcategory={subcategory || ''}
        modeName="Sentence Box"
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
    </div>
  );
}
