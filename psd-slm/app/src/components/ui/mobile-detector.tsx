'use client'

import { type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSidebar } from '@/components/sidebar-provider'

interface MobileDetectorProps {
  mobile: ReactNode
  desktop: ReactNode
}

export function MobileDetector({ mobile, desktop }: MobileDetectorProps) {
  const { isMobile } = useSidebar()
  const searchParams = useSearchParams()
  const forceDesktop = searchParams.get('view') === 'dashboard'
  return <>{isMobile && !forceDesktop ? mobile : desktop}</>
}
