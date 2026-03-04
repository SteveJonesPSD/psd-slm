'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600',
  primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50',
  ghost: 'bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700',
  blue: 'bg-blue-600 text-white hover:bg-blue-700',
  purple: 'bg-purple-600 text-white hover:bg-purple-700',
} as const

const sizes = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  children: ReactNode
}

export function Button({
  variant = 'default',
  size = 'md',
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer',
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-default pointer-events-none',
        className
      )}
    >
      {children}
    </button>
  )
}
