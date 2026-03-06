'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { PortalContext } from '@/lib/portal/types'

const PortalCtx = createContext<PortalContext | null>(null)

export function PortalProvider({
  value,
  children,
}: {
  value: PortalContext
  children: ReactNode
}) {
  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>
}

export function usePortal(): PortalContext {
  const ctx = useContext(PortalCtx)
  if (!ctx) throw new Error('usePortal must be used within a PortalProvider')
  return ctx
}
