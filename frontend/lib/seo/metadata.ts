import type { Metadata, Viewport } from 'next'

/**
 * Base URL for the application
 */
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://admin.yalla.tj'

/**
 * Default metadata for the application
 */
export const defaultMetadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  
  // Basic metadata
  title: {
    default: 'Yalla Business Admin',
    template: '%s | Yalla Business Admin',
  },
  description: 'B2B платформа для управления питанием сотрудников. Комплексные обеды и компенсации для вашей команды.',
  
  // Keywords
  keywords: [
    'Yalla',
    'корпоративное питание',
    'обеды для сотрудников',
    'B2B',
    'food delivery',
    'Таджикистан',
    'Душанбе',
    'управление командой',
  ],
  
  // Authors
  authors: [{ name: 'Yalla' }],
  creator: 'Yalla',
  publisher: 'Yalla',
  
  // Open Graph
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    url: BASE_URL,
    siteName: 'Yalla Business Admin',
    title: 'Yalla Business Admin',
    description: 'B2B платформа для управления питанием сотрудников',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Yalla Business Admin',
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: 'summary_large_image',
    title: 'Yalla Business Admin',
    description: 'B2B платформа для управления питанием сотрудников',
    images: ['/og-image.png'],
  },
  
  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  
  // Icons
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  
  // Manifest (for PWA)
  manifest: '/manifest.json',
  
  // Verification (add your verification codes here)
  // verification: {
  //   google: 'your-google-verification-code',
  //   yandex: 'your-yandex-verification-code',
  // },
  
  // Category
  category: 'business',
  
  // Format detection
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
}

/**
 * Default viewport settings
 */
export const defaultViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6ff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0a1f' },
  ],
}

/**
 * Generate page-specific metadata
 */
export function generatePageMetadata(
  title: string,
  description?: string,
  options?: {
    noIndex?: boolean
    image?: string
    path?: string
  }
): Metadata {
  const { noIndex = false, image, path = '' } = options || {}
  
  return {
    title,
    description: description || defaultMetadata.description,
    
    openGraph: {
      ...defaultMetadata.openGraph,
      title,
      description: description || (defaultMetadata.description as string),
      url: `${BASE_URL}${path}`,
      ...(image && {
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      }),
    },
    
    twitter: {
      ...defaultMetadata.twitter,
      title,
      description: description || (defaultMetadata.description as string),
      ...(image && { images: [image] }),
    },
    
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  }
}

/**
 * Generate JSON-LD structured data for organization
 */
export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Yalla',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'B2B платформа для управления питанием сотрудников',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'TJ',
      addressLocality: 'Душанбе',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['Russian', 'Tajik'],
    },
  }
}

/**
 * Generate JSON-LD structured data for software application
 */
export function generateSoftwareApplicationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Yalla Business Admin',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    description: 'B2B платформа для управления питанием сотрудников',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'TJS',
    },
  }
}

/**
 * Generate JSON-LD structured data for breadcrumbs
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.url}`,
    })),
  }
}

