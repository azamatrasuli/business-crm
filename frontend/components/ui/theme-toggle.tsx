"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const rafId = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(rafId)
  }, [])

  const isDark = resolvedTheme === "dark"

  const handleToggle = () => {
    setTheme(isDark ? "light" : "dark")
  }

  // Предотвращаем гидратацию, не рендеря атрибут до монтирования
  const themeToggleAttr = mounted ? (isDark ? "dark" : "light") : undefined

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative"
      onClick={handleToggle}
      aria-label="Переключить тему"
      {...(mounted && { "data-theme-toggle": themeToggleAttr })}
    >
      <Sun
        className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
      <span className="sr-only">Переключить тему</span>
    </Button>
  )
}

