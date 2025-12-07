import type { MetadataRoute } from 'next'

/**
 * Generate robots.txt
 * Tells search engines which pages to crawl
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.yalla.tj'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',        // API routes
          '/login',       // Auth pages
          '/forgot-password',
          '/reset-password',
          '/_next/',      // Next.js internal
          '/private/',    // Private routes (if any)
        ],
      },
      // Specific rules for Googlebot (optional)
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/login', '/_next/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}

