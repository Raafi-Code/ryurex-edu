'use client';

import { ArrowLeft, Clock } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { motion } from 'framer-motion';

interface GameNavbarProps {
  currentIndex: number;
  totalQuestions: number;
  timer?: number;
  category?: string;
  subcategory?: string;
  modeName?: string;
  onBack: () => void;
}

export default function GameNavbar({
  currentIndex,
  totalQuestions,
  timer,
  category,
  subcategory,
  modeName,
  onBack,
}: GameNavbarProps) {
  return (
    <div className="border-b border-text-secondary/10">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-text-secondary hover:text-primary-yellow transition-colors cursor-pointer text-body-lg"
            >
              <ArrowLeft className="w-4 sm:w-5 h-4 sm:h-5" />
              <span>Back</span>
            </button>
          </div>

          {/* Progress - Center */}
          <div className="flex-1 text-center text-text-secondary text-label">
            Question <span className="text-primary-yellow font-bold">{currentIndex + 1}</span> / {totalQuestions}
          </div>

          {/* Right side - Timer or Mode Badge */}
          <div className="flex-1 flex items-center justify-end gap-1 sm:gap-2 text-text-secondary text-label">
            {timer !== undefined ? (
              <>
                <Clock className="w-4 sm:w-5 h-4 sm:h-5" />
                <span className="font-mono">{timer}s</span>
              </>
            ) : modeName ? (
              <span className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-yellow text-black text-label font-bold rounded-lg border-2 border-black">
                {modeName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Theme Toggle - Fixed Position Bottom Right */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}
