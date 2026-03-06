'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { seedCollectionData } from '@/lib/collections/seed-action'

export function SeedCollectionsButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [pendingToken, setPendingToken] = useState<string | null>(null)

  async function handleSeed() {
    setLoading(true)
    setResult(null)
    setPendingToken(null)

    const res = await seedCollectionData()

    if (res.error) {
      setResult(`Error: ${res.error}`)
    } else if (res.success) {
      setResult(res.message || 'Collections seeded successfully')
      if (res.created?.pendingToken) {
        setPendingToken(res.created.pendingToken as string)
      }
    }

    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="primary"
        onClick={handleSeed}
        disabled={loading}
      >
        {loading ? 'Seeding...' : 'Seed Data'}
      </Button>
      {result && (
        <p className={`text-xs max-w-xs text-right ${result.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </p>
      )}
      {pendingToken && (
        <a
          href={`/collect/${pendingToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 underline"
        >
          Test magic link →
        </a>
      )}
    </div>
  )
}
