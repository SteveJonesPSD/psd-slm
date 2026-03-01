'use client'

import { createContext, useContext } from 'react'
import type { AuthUser } from '@/lib/auth'

interface AuthContextValue {
  user: AuthUser
  hasPermission: (module: string, action: string) => boolean
  hasAnyPermission: (checks: { module: string; action: string }[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser
  children: React.ReactNode
}) {
  const hasPermission = (module: string, action: string) =>
    user.permissions.includes(`${module}.${action}`)

  const hasAnyPermission = (checks: { module: string; action: string }[]) =>
    checks.some((c) => hasPermission(c.module, c.action))

  return (
    <AuthContext.Provider value={{ user, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
