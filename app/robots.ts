import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/forgot-password'],
        disallow: ['/dashboard', '/review-mode', '/vocabgame', '/category-menu', '/update-password', '/api/'],
        crawlDelay: 1,
      },
    ],
    sitemap: 'https://ryurex-edu.vercel.app/sitemap.xml',
  };
}
