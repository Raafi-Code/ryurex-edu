'use client';

export default function StructuredData() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'RyuLearn',
    description: 'Learn English vocabulary through gamification, spaced repetition, and adaptive learning',
    url: 'https://ryurex-edu.vercel.app',
    applicationCategory: 'EducationalApplication',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'RyuLearn',
      url: 'https://ryurex-edu.vercel.app',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
