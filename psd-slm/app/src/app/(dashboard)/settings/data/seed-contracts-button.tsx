'use client'

import { useState } from 'react'
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
      <button
        onClick={handleSeed}
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? 'Seeding...' : 'Seed Contracts'}
      </button>
      {result && <span className="text-xs text-slate-500">{result}</span>}
    </div>
  )
}
