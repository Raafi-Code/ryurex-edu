'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TypewriterTextProps {
  texts?: string[];
  text?: string;
  speed?: number;
  className?: string;
  cursorVisible?: boolean;
  loopDelay?: number; // Delay between text loops in milliseconds
}

export default function TypewriterText({
  texts = [],
  text = '',
  speed = 50,
  className = '',
  cursorVisible = true,
  loopDelay = 3000, // 3 seconds default
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const textList = texts.length > 0 ? texts : [text];
  const currentText = textList[textIndex] || '';

  useEffect(() => {
    if (textList.length <= 1) {
      // Single text mode - original behavior
      if (currentIndex < currentText.length) {
        const timer = setTimeout(() => {
          setDisplayedText(prev => prev + currentText[currentIndex]);
          setCurrentIndex(prev => prev + 1);
        }, speed);

        return () => clearTimeout(timer);
      }
    } else {
      // Multiple texts looping mode
      if (isWaiting) {
        const waitTimer = setTimeout(() => {
          setIsWaiting(false);
          setCurrentIndex(0);
          setDisplayedText('');
          setTextIndex(prev => (prev + 1) % textList.length);
        }, loopDelay);

        return () => clearTimeout(waitTimer);
      }

      if (!isDeleting) {
        // Typing phase
        if (currentIndex < currentText.length) {
          const typeTimer = setTimeout(() => {
            setDisplayedText(prev => prev + currentText[currentIndex]);
            setCurrentIndex(prev => prev + 1);
          }, speed);

          return () => clearTimeout(typeTimer);
        } else {
          // Text completed, wait before moving to next
          const completeTimer = setTimeout(() => {
            setIsWaiting(true);
          }, loopDelay);

          return () => clearTimeout(completeTimer);
        }
      }
    }
  }, [currentIndex, textIndex, currentText, speed, isDeleting, isWaiting, textList.length, loopDelay]);

  return (
    <div className={`flex items-center ${className}`}>
      <span>{displayedText}</span>
      {cursorVisible && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="ml-1 w-1 h-8 bg-black"
        />
      )}
    </div>
  );
}

