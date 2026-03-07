'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function SessionRefresh() {
  useEffect(() => {
    const supabase = createClient()

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await supabase.auth.getSession()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return null
}
