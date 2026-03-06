'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
      <Button
        variant="primary"
        onClick={handleSeed}
        disabled={loading}
      >
        {loading ? 'Seeding...' : 'Seed Data'}
      </Button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
