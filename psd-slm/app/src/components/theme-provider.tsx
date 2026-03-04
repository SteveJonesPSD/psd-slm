'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  setTheme: () => {},
  resolvedTheme: 'light',
})

export function useTheme() {
  return useContext(ThemeContext)
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  const root = document.documentElement
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  return resolved
}

export function ThemeProvider({
  initialTheme = 'system',
  children,
}: {
  initialTheme?: string
  children: React.ReactNode
}) {
  const [theme, setThemeState] = useState<Theme>((initialTheme as Theme) || 'system')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
    const resolved = applyTheme(t)
    setResolvedTheme(resolved)
  }, [])

  // Apply theme on mount and listen for system changes
  useEffect(() => {
    // Check localStorage first (may differ from DB if user changed before page load)
    const stored = localStorage.getItem('theme') as Theme | null
    const effective = stored || (initialTheme as Theme) || 'system'
    setThemeState(effective)
    const resolved = applyTheme(effective)
    setResolvedTheme(resolved)

    // Listen for OS theme changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if ((localStorage.getItem('theme') || initialTheme || 'system') === 'system') {
        const r = applyTheme('system')
        setResolvedTheme(r)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [initialTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
