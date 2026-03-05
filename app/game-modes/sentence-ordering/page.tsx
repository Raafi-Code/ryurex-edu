'use client';

import { Suspense } from 'react';
import SentenceOrderingContent from './sentence-ordering-content';

export default function SentenceOrderingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading game...</p>
          </div>
        </div>
      }
    >
      <SentenceOrderingContent />
    </Suspense>
  );
}
