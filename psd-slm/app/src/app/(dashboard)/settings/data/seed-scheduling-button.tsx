'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { seedSchedulingData } from '@/app/(dashboard)/scheduling/seed-action'

export function SeedSchedulingButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleSeed() {
    setLoading(true)
    setResult(null)

    const res = await seedSchedulingData()

    if (res.error) {
      setResult(`Error: ${res.error}`)
    } else if (res.success) {
      if (res.message) {
        setResult(res.message as string)
      } else {
        const c = res.created as { job_types: number; jobs: number; notes: number }
        setResult(`Seeded ${c.job_types} job types, ${c.jobs} jobs, ${c.notes} notes`)
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
        <p className={`text-xs ${result.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </p>
      )}
    </div>
  )
}
