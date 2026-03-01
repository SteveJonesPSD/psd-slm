'use client'

import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string
  onChange?: (value: string) => void
}

export function Input({ label, onChange, className, ...props }: InputProps) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {label}
        </label>
      )}
      <input
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
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
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {label}
        </label>
      )}
      <select
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
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
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {label}
        </label>
      )}
      <textarea
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        rows={props.rows || 3}
        className="w-full resize-vertical rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 font-[inherit]"
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
      <span className="text-slate-700">{label}</span>
    </label>
  )
}
