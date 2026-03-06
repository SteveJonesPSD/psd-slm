'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { seedStockData } from '@/app/(dashboard)/stock/actions'

export function SeedStockButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSeed = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const result = await seedStockData()
      if ('error' in result) {
        setMessage({ type: 'error', text: result.error as string })
      } else {
        setMessage({
          type: 'success',
          text: `Stock seeded: ${result.levelsCreated} product levels, ${result.serialsCreated} serial numbers.`,
        })
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
        {loading ? 'Seeding...' : 'Seed Stock Data'}
      </Button>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
