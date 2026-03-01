'use client'

import { useState, useRef } from 'react'

interface CurrencyInputProps {
  value: number | null
  onChange: (value: number | null) => void
  label?: string
  className?: string
  disabled?: boolean
}

export function CurrencyInput({ value, onChange, label, className, disabled }: CurrencyInputProps) {
  const [display, setDisplay] = useState(value != null ? value.toFixed(2) : '')
  const isFocused = useRef(false)

  // Only sync from external value when not focused (e.g. form reset)
  // This prevents overwriting the user's typing with formatted values
  const externalValue = value != null ? value.toFixed(2) : ''
  if (!isFocused.current && display !== externalValue) {
    setDisplay(externalValue)
  }

  const handleChange = (raw: string) => {
    if (raw === '') {
      setDisplay('')
      onChange(null)
      return
    }
    // Only allow valid numeric input with up to 2 decimal places
    if (/^\d*\.?\d{0,2}$/.test(raw)) {
      setDisplay(raw)
      const num = parseFloat(raw)
      if (!isNaN(num)) {
        onChange(num)
      }
    }
  }

  const handleFocus = () => {
    isFocused.current = true
  }

  const handleBlur = () => {
    isFocused.current = false
    if (display === '') {
      onChange(null)
      return
    }
    const num = parseFloat(display)
    if (!isNaN(num)) {
      setDisplay(num.toFixed(2))
      onChange(num)
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          £
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={display}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="—"
          className="w-full rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-2 text-sm outline-none focus:border-slate-400 disabled:opacity-50"
        />
      </div>
    </div>
  )
}
