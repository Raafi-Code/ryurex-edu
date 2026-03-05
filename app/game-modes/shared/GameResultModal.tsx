'use client';

import { motion } from 'framer-motion';
import { RotateCcw, Home, ArrowLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

interface GameResultModalProps {
  correctCount: number;
  totalCount: number;
  accuracy: string;
  avgTime?: string;
  totalTime?: number;
  xpGained?: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  onBackToCategory?: () => void;
  onNextPart?: () => void;
  hasNextPart?: boolean;
  showPlayAgain?: boolean;
  showBackToCategory?: boolean;
  showNextPart?: boolean;
}

export default function GameResultModal({
  correctCount,
  totalCount,
  accuracy,
  avgTime = 'N/A',
  totalTime = 0,
  xpGained = 0,
  onPlayAgain,
  onBackToMenu,
  onBackToCategory,
  onNextPart,
  hasNextPart = false,
  showPlayAgain = true,
  showBackToCategory = false,
  showNextPart = false,
}: GameResultModalProps) {
  const { theme } = useTheme();

  // Format time to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 flex items-center justify-center p-4 z-50 bg-black/50`}
      onClick={onBackToMenu}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        onClick={(e) => e.stopPropagation()}
        className={`border-2 border-primary-yellow rounded-2xl md:rounded-3xl p-4 md:p-8 max-w-xs sm:max-w-sm md:max-w-md w-full shadow-2xl ${
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
              Great job on finishing {totalCount} questions
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-3 md:space-y-4">
            {/* XP Gained - Large Card */}
            {xpGained > 0 && (
              <div className="bg-primary-yellow rounded-xl md:rounded-2xl p-3 md:p-6">
                <p className="text-black/70 text-xs md:text-sm font-semibold">Total XP Gained</p>
                <p className="text-3xl md:text-5xl font-bold text-black">+{xpGained}</p>
              </div>
            )}

            {/* Accuracy & Time Grid */}
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <div className={`rounded-lg md:rounded-xl p-2 md:p-4 ${
                theme === 'dark'
                  ? 'bg-card-darker border border-gray-700'
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Accuracy
                </p>
                <p className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {accuracy}%
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>{correctCount}/{totalCount} correct</p>
              </div>

              <div className={`rounded-lg md:rounded-xl p-2 md:p-4 ${
                theme === 'dark'
                  ? 'bg-card-darker border border-gray-700'
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Total Time
                </p>
                <p className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {formatTime(totalTime)}
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>{totalCount} questions</p>
              </div>

              <div className={`rounded-lg md:rounded-xl p-2 md:p-4 ${
                theme === 'dark'
                  ? 'bg-card-darker border border-gray-700'
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Avg Time
                </p>
                <p className={`text-2xl md:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
                  {avgTime}s
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>per question</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-2 md:gap-4 pt-1 md:pt-2 flex-wrap">
            {showPlayAgain && (
              <button
                onClick={onPlayAgain}
                title="Play Again"
                className="p-2 md:p-4 bg-primary-yellow text-black rounded-full hover:bg-primary-yellow-hover hover:scale-110 transition-all shadow-lg cursor-pointer"
              >
                <RotateCcw className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}

            {showNextPart && (
              <button
                onClick={() => onNextPart?.()}
                disabled={!hasNextPart}
                title={hasNextPart ? "Next Part" : "No more parts available"}
                className={`p-2 md:p-4 rounded-full border-2 transition-all shadow-lg ${
                  hasNextPart
                    ? 'cursor-pointer hover:scale-110 bg-card border-primary-yellow text-primary-yellow hover:bg-primary-yellow/10'
                    : 'cursor-not-allowed opacity-50 bg-card border-gray-600 text-gray-600'
                }`}
              >
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}

            {showBackToCategory && (
              <button
                onClick={onBackToCategory}
                title="Back to Category"
                className="p-2 md:p-4 rounded-full border-2 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-all hover:scale-110 shadow-lg cursor-pointer bg-card"
              >
                <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}

            <button
              onClick={onBackToMenu}
              title="Back to Dashboard"
              className="p-2 md:p-4 rounded-full border-2 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-300 transition-all hover:scale-110 shadow-lg cursor-pointer bg-card"
            >
              <Home className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
