'use client'

import { type ReactNode } from 'react'
import { useSidebar } from '@/components/sidebar-provider'

interface MobileDetectorProps {
  mobile: ReactNode
  desktop: ReactNode
}

export function MobileDetector({ mobile, desktop }: MobileDetectorProps) {
  const { isMobile } = useSidebar()
  return <>{isMobile ? mobile : desktop}</>
}
