'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ChevronRight } from 'lucide-react';

interface FeedbackSubmitButtonProps {
  onSubmit: () => void;
  onNext: () => void;
  disabled: boolean;
  isSubmitting: boolean;
  feedback: 'correct' | 'wrong' | null;
  correctAnswer: string;
  explanation?: string | null;
  submitLabel?: string;
}

export default function FeedbackSubmitButton({
  onSubmit,
  onNext,
  disabled,
  isSubmitting,
  feedback,
  correctAnswer,
  explanation,
  submitLabel = 'Check Answer',
}: FeedbackSubmitButtonProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <>
      {/* Submit Button - Shows Status Inline */}
      <div className="text-center">
        <button
          onClick={onSubmit}
          disabled={disabled || isSubmitting || !!feedback}
          className={`w-32 sm:w-40 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all cursor-pointer ${
            feedback === 'correct'
              ? 'bg-green-500 text-white'
              : feedback === 'wrong'
                ? 'bg-red-500 text-white'
                : 'bg-primary-yellow text-black hover:bg-primary-yellow-hover disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {feedback === 'correct' ? 'Correct!' : feedback === 'wrong' ? 'Wrong!' : isSubmitting ? 'Checking...' : submitLabel}
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
              Correct answer: <span className="text-primary-yellow font-bold">{correctAnswer}</span>
            </div>

            {/* Buttons: Centered side-by-side */}
            <div className="flex items-center justify-center gap-4 mb-4">
              {explanation && (
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
                onClick={onNext}
                className="px-4 py-2 bg-primary-yellow text-black rounded-lg font-semibold hover:bg-primary-yellow-hover transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Explanation - Toggle display */}
            <AnimatePresence>
              {showExplanation && explanation && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-lg mx-auto bg-surface border border-text-secondary/20 rounded-lg px-4 py-3"
                >
                  <p className="text-sm text-text-secondary italic">
                    💡 {explanation}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
