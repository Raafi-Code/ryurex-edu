'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pagesToShow: (number | string)[] = [];
  const maxPagesToShow = 1; // Show 1 before and 1 after current page

  // Add first page
  pagesToShow.push(1);

  // Determine range around current page
  const rangeStart = Math.max(2, currentPage - maxPagesToShow);
  const rangeEnd = Math.min(totalPages - 1, currentPage + maxPagesToShow);

  // Add ellipsis if needed
  if (rangeStart > 2) {
    pagesToShow.push('...');
  }

  // Add pages in range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pagesToShow.push(i);
  }

  // Add ellipsis if needed
  if (rangeEnd < totalPages - 1) {
    pagesToShow.push('...');
  }

  // Add last page if there's more than 1 page
  if (totalPages > 1) {
    pagesToShow.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className="p-2 rounded-lg bg-primary-yellow border border-primary-yellow hover:bg-primary-yellow/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-5 h-5 text-black" />
      </button>

      <div className="flex items-center gap-2">
        {pagesToShow.map((pageItem, idx) => (
          pageItem === '...' ? (
            <span key={`ellipsis-${idx}`} className="text-text-secondary font-bold">
              ...
            </span>
          ) : (
            <button
              key={pageItem}
              onClick={() => onPageChange(pageItem as number)}
              className={`w-8 h-8 rounded-lg font-bold text-base transition-colors cursor-pointer ${
                currentPage === pageItem
                  ? 'bg-primary-yellow text-black'
                  : 'bg-card hover:bg-card/80 text-text-primary'
              }`}
              aria-label={`Go to page ${pageItem}`}
              aria-current={currentPage === pageItem ? 'page' : undefined}
            >
              {pageItem}
            </button>
          )
        ))}
      </div>

      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg bg-primary-yellow border border-primary-yellow hover:bg-primary-yellow/80 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="w-5 h-5 text-black" />
      </button>
    </div>
  );
}
