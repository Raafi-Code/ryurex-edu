'use client';

import { motion } from 'framer-motion';

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 mt-3 sm:mt-4">
      <div className="h-2 bg-surface rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary-yellow"
          initial={{ width: 0 }}
          animate={{ width: `${((current + 1) / total) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
