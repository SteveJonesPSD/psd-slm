'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { seedHelpdeskData } from '@/app/(dashboard)/helpdesk/seed-action'

export function SeedHelpdeskButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSeed = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const result = await seedHelpdeskData()
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error as string })
      } else {
        setMessage({ type: 'success', text: 'Helpdesk data seeded successfully.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'An unexpected error occurred.' })
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
        {loading ? 'Seeding...' : 'Seed Helpdesk'}
      </Button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
