'use client';

import { motion } from 'framer-motion';

interface LoadingScreenProps {
  title?: string;
}

export default function LoadingScreen({ title = 'Loading your dashboard' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
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
            {title}
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
    </div>
  );
}
