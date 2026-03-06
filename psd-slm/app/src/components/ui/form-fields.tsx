'use client'

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useState, useRef, useEffect, useMemo } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  onChange?: (value: string) => void
}

export function Input({ label, onChange, className, ...props }: InputProps) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <input
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
      />
    </div>
  )
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string
  options: { value: string; label: string }[]
  placeholder?: string
  onChange?: (value: string) => void
}

export function Select({ label, options, placeholder, onChange, className, ...props }: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <select
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string
  onChange?: (value: string) => void
}

export function Textarea({ label, onChange, className, ...props }: TextareaProps) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}
      <textarea
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        rows={props.rows || 3}
        className="w-full resize-vertical rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 font-[inherit]"
      />
    </div>
  )
}

interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Checkbox({ label, checked, onChange, className }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-2 text-sm cursor-pointer ${className || ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-slate-300"
      />
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  )
}

// --- SearchableSelect ---

interface SearchableSelectProps {
  label?: string
  required?: boolean
  value: string
  options: { value: string; label: string }[]
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  /** Optional "create new" action shown at the bottom of the dropdown */
  createOption?: { label: string; onSelect: () => void } | null
  /** Size variant — 'sm' renders a compact version for inline/table use */
  size?: 'default' | 'sm'
}

export function SearchableSelect({
  label,
  required,
  value,
  options,
  placeholder = 'Search...',
  onChange,
  disabled,
  className,
  createOption,
  size = 'default',
}: SearchableSelectProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    if (!search) return options
    const q = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (id: string) => {
    onChange(id)
    setSearch('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setSearch('')
  }

  const isSm = size === 'sm'
  const inputCls = isSm
    ? 'w-full rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200 px-2 py-1 text-xs outline-none focus:border-slate-400 disabled:bg-slate-50 dark:disabled:bg-slate-700 disabled:opacity-50'
    : 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50 dark:disabled:bg-slate-700 disabled:opacity-50'
  const dropdownCls = isSm
    ? 'absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg max-h-48 overflow-y-auto'
    : 'absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto'
  const itemCls = isSm
    ? 'w-full text-left px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 truncate'
    : 'w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200 truncate'

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}{required && ' *'}
        </label>
      )}
      <div ref={containerRef} className="relative">
        {selectedOption && !isOpen ? (
          <div
            className={`flex items-center justify-between cursor-pointer ${inputCls}`}
            onClick={() => { if (!disabled) { setSearch(''); setIsOpen(true) } }}
          >
            <span className="truncate">{selectedOption.label}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleClear() }}
                className="ml-2 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setIsOpen(true) }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={inputCls}
          />
        )}

        {isOpen && !disabled && (
          <div className={dropdownCls}>
            {filtered.length === 0 && !createOption && (
              <div className={`${isSm ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} text-slate-400`}>No results found</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handleSelect(o.value)}
                className={itemCls}
              >
                {o.label}
              </button>
            ))}
            {createOption && (
              <button
                type="button"
                onClick={() => { createOption.onSelect(); setIsOpen(false) }}
                className={`${itemCls} text-purple-600 font-medium hover:bg-purple-50 border-t border-slate-100`}
              >
                {createOption.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
