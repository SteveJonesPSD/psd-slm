'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { APP_VERSION } from '@/lib/version'

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'That login link has expired. Please request a new one.',
  used: 'That login link has already been used. Please request a new one.',
  invalid: 'That login link is invalid. Please request a new one.',
  inactive: 'Your portal account is not active. Please contact your administrator.',
}

function usePortalBranding() {
  const [branding, setBranding] = useState<{ url: string | null; orgName: string }>({ url: null, orgName: 'Innov8iv Engage' })
  useEffect(() => {
    fetch('/api/settings/portal-logo')
      .then(r => r.json())
      .then(d => setBranding({ url: d.url || null, orgName: d.orgName || 'Innov8iv Engage' }))
      .catch(() => {})
  }, [])
  return branding
}

export default function PortalLoginPage() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const branding = usePortalBranding()
  const hasCustomLogo = Boolean(branding.url)

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await fetch('/api/portal/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      // Always show success (no enumeration)
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] dark:bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            {hasCustomLogo ? (
              <img src={branding.url!} alt={branding.orgName} className="h-14 w-auto" />
            ) : (
              <img src="/innov8iv-logo.png" alt="Innov8iv Engage" className="h-14 w-auto" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{branding.orgName} Portal</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in with your email to get started</p>
        </div>

        {errorParam && ERROR_MESSAGES[errorParam] && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {ERROR_MESSAGES[errorParam]}
          </div>
        )}

        {sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <svg className="mx-auto mb-3 h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <h2 className="text-lg font-semibold text-green-800">Check your email</h2>
            <p className="mt-2 text-sm text-green-700">
              We&apos;ve sent a login link to <strong>{email}</strong>. Click the link in the email to sign in.
            </p>
            <p className="mt-3 text-xs text-green-600">The link expires in 15 minutes.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your.email@company.com"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Login Link'}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              Don&apos;t have access? Contact your IT administrator.
            </p>
          </form>
        )}

        {/* Powered by — only shown when custom org logo is set */}
        {hasCustomLogo && (
          <div className="mt-8 flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Powered by</span>
            <img src="/innov8iv-logo.png" alt="Innov8iv Engage" className="h-5 w-auto opacity-40" />
          </div>
        )}

        <div className="mt-6 text-center text-[10px] text-slate-300 dark:text-slate-600">v{APP_VERSION}</div>
      </div>
    </div>
  )
}
