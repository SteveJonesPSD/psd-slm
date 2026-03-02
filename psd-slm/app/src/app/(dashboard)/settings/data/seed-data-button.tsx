'use client'

import { useState } from 'react'
import { seedSettings } from '../actions'

export function SeedDataButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSeed = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const result = await seedSettings()
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error as string })
      } else {
        setMessage({ type: 'success', text: 'Default settings and brands seeded successfully.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={handleSeed}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Seeding...' : 'Seed Data'}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
