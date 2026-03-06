'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { seedContractTypes } from '../../contracts/actions'

export function SeedContractsButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSeed = async () => {
    setLoading(true)
    setResult(null)
    const res = await seedContractTypes()
    setLoading(false)
    setResult(res.error || res.message || 'Done')
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        onClick={handleSeed}
        disabled={loading}
      >
        {loading ? 'Seeding...' : 'Seed Contracts'}
      </Button>
      {result && <span className="text-xs text-slate-500">{result}</span>}
    </div>
  )
}
