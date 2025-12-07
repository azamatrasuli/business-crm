'use client'

import { cn } from '@/lib/utils'

interface SkipLinkProps {
  /** ID of the main content element to skip to */
  targetId?: string
  /** Custom label for the skip link */
  label?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Skip Link component for keyboard navigation accessibility
 * 
 * Allows keyboard users to skip directly to main content,
 * bypassing navigation and other repeated elements.
 * 
 * The link is visually hidden until focused.
 * 
 * @example
 * ```tsx
 * // In your layout
 * <SkipLink />
 * <nav>...</nav>
 * <main id="main-content" tabIndex={-1}>...</main>
 * ```
 */
export function SkipLink({
  targetId = 'main-content',
  label = 'Перейти к основному содержимому',
  className,
}: SkipLinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.focus()
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        // Visually hidden by default
        'sr-only',
        // Visible when focused
        'focus:not-sr-only',
        'focus:fixed focus:top-4 focus:left-4 focus:z-[9999]',
        'focus:bg-primary focus:text-primary-foreground',
        'focus:px-4 focus:py-2 focus:rounded-md',
        'focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring',
        'focus:animate-in focus:fade-in-0 focus:zoom-in-95',
        'transition-all duration-200',
        className
      )}
    >
      {label}
    </a>
  )
}

/**
 * Skip Navigation component with multiple skip targets
 * For complex pages with multiple landmark regions
 */
export function SkipNavigation({
  links = [
    { targetId: 'main-content', label: 'Перейти к основному содержимому' },
    { targetId: 'main-nav', label: 'Перейти к навигации' },
  ],
  className,
}: {
  links?: Array<{ targetId: string; label: string }>
  className?: string
}) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const target = document.getElementById(targetId)
    if (target) {
      target.focus()
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav
      aria-label="Быстрая навигация"
      className={cn(
        // Visually hidden by default
        'sr-only',
        // Visible when children are focused
        'focus-within:not-sr-only',
        'focus-within:fixed focus-within:top-0 focus-within:left-0 focus-within:right-0',
        'focus-within:z-[9999] focus-within:bg-background/95 focus-within:backdrop-blur',
        'focus-within:border-b focus-within:shadow-lg',
        'focus-within:p-4',
        className
      )}
    >
      <ul className="flex flex-wrap gap-2">
        {links.map(({ targetId, label }) => (
          <li key={targetId}>
            <a
              href={`#${targetId}`}
              onClick={(e) => handleClick(e, targetId)}
              className={cn(
                'inline-block px-4 py-2 rounded-md',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'transition-colors'
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

