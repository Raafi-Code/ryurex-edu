'use client';

import { Suspense } from 'react';
import VocabContent from './vocab-content';

export default function VocabPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading vocabulary...</p>
        </div>
      </div>
    }>
      <VocabContent />
    </Suspense>
  );
}
