'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const variants = {
  default: 'border border-slate-300 bg-slate-500/10 text-slate-700 hover:shadow-[0_0_12px_rgba(100,116,139,0.3)] dark:border-slate-500 dark:bg-slate-400/10 dark:text-slate-300 dark:hover:shadow-[0_0_12px_rgba(148,163,184,0.25)]',
  primary: 'border border-blue-500 bg-blue-500/15 text-blue-700 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)] dark:border-blue-400 dark:bg-blue-400/15 dark:text-blue-300 dark:hover:shadow-[0_0_12px_rgba(96,165,250,0.4)]',
  success: 'border border-emerald-500 bg-emerald-500/15 text-emerald-700 hover:shadow-[0_0_12px_rgba(16,185,129,0.5)] dark:border-emerald-400 dark:bg-emerald-400/15 dark:text-emerald-300 dark:hover:shadow-[0_0_12px_rgba(52,211,153,0.4)]',
  danger: 'border border-red-400 bg-red-500/15 text-red-600 hover:shadow-[0_0_12px_rgba(239,68,68,0.4)] dark:border-red-500 dark:bg-red-400/15 dark:text-red-400 dark:hover:shadow-[0_0_12px_rgba(248,113,113,0.35)]',
  ghost: 'border border-transparent bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700',
  blue: 'border border-blue-500 bg-blue-500/15 text-blue-700 hover:shadow-[0_0_12px_rgba(59,130,246,0.5)] dark:border-blue-400 dark:bg-blue-400/15 dark:text-blue-300 dark:hover:shadow-[0_0_12px_rgba(96,165,250,0.4)]',
  purple: 'border border-purple-500 bg-purple-500/15 text-purple-700 hover:shadow-[0_0_12px_rgba(168,85,247,0.5)] dark:border-purple-400 dark:bg-purple-400/15 dark:text-purple-300 dark:hover:shadow-[0_0_12px_rgba(192,132,252,0.4)]',
  orange: 'border border-orange-500 bg-orange-500/15 text-orange-700 hover:shadow-[0_0_12px_rgba(249,115,22,0.5)] dark:border-orange-400 dark:bg-orange-400/15 dark:text-orange-300 dark:hover:shadow-[0_0_12px_rgba(251,146,60,0.4)]',
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
        'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all cursor-pointer',
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
