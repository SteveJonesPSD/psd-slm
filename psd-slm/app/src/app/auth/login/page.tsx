'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { APP_VERSION } from '@/lib/version'
import {
  resolveLoginMethod,
  sendMagicLink,
  signInWithPassword,
  verifyMfaCode,
  trustCurrentDevice,
} from '@/app/auth/login/actions'
import { signOut } from '@/app/auth/actions'
import type { LoginMethod } from '@/lib/login-methods'

type Step =
  | 'email'
  | 'magic_link'
  | 'magic_link_sent'
  | 'password'
  | 'password_mfa'
  | 'totp'
  | 'remember_device'

function LoginFlow() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTo = searchParams.get('redirect') || '/'
  const callbackError = searchParams.get('error')

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState<string | null>(callbackError === 'auth_callback_failed' ? 'Sign-in link expired or invalid. Please try again.' : null)
  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<LoginMethod>('password')
  const [hasPassword, setHasPassword] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)

  const passwordRef = useRef<HTMLInputElement>(null)
  const totpRef = useRef<HTMLInputElement>(null)

  // Auto-focus password/totp when step changes
  useEffect(() => {
    if (step === 'password' || step === 'password_mfa') {
      passwordRef.current?.focus()
    } else if (step === 'totp') {
      totpRef.current?.focus()
    }
  }, [step])

  function resetToEmail() {
    setStep('email')
    setEmail('')
    setPassword('')
    setTotpCode('')
    setError(null)
    setFactorId(null)
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await resolveLoginMethod(email)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setMethod(result.method)
    setHasPassword(result.hasPassword)

    if (result.method === 'magic_link') {
      setStep('magic_link')
    } else if (result.method === 'password_mfa') {
      setStep('password_mfa')
    } else {
      setStep('password')
    }
  }

  async function handleSendMagicLink() {
    setError(null)
    setLoading(true)
    const result = await sendMagicLink(email)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }
    setStep('magic_link_sent')
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signInWithPassword(email, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.mfaNotEnrolled) {
      router.push('/auth/mfa-setup')
      return
    }

    if (result.deviceTrusted) {
      router.push(redirectTo)
      return
    }

    if (result.mfaRequired && result.factorId) {
      setFactorId(result.factorId)
      setStep('totp')
      return
    }

    router.push(redirectTo)
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)

    const result = await verifyMfaCode(factorId, totpCode)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setStep('remember_device')
  }

  async function handleTrustDevice() {
    setLoading(true)
    await trustCurrentDevice()
    router.push(redirectTo)
  }

  async function handleSkipTrust() {
    router.push(redirectTo)
  }

  async function handleBackToEmail() {
    // If we're past password auth, sign out the partial session
    if (step === 'totp' || step === 'remember_device') {
      await signOut()
    }
    resetToEmail()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      {/* Step 1: Email */}
      {step === 'email' && (
        <>
          <h2 className="mb-5 text-lg font-semibold text-slate-900 dark:text-white">Sign in</h2>
          {error && <ErrorBanner message={error} />}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="text"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="you@psdgroup.co.uk"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>

          {/* FUTURE: Add "Sign in with Microsoft" button for SSO login methods */}
          <div className="mt-5 border-t border-slate-100 dark:border-slate-700 pt-5">
            <button
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
            >
              <svg className="h-4 w-4" viewBox="0 0 21 21" fill="none">
                <path d="M10 0H0v10h10V0Z" fill="#F25022" />
                <path d="M21 0H11v10h10V0Z" fill="#7FBA00" />
                <path d="M10 11H0v10h10V11Z" fill="#00A4EF" />
                <path d="M21 11H11v10h10V11Z" fill="#FFB900" />
              </svg>
              Sign in with Microsoft (coming soon)
            </button>
          </div>
        </>
      )}

      {/* Step 2a/2b: Magic Link */}
      {step === 'magic_link' && (
        <>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Sign in with email link</h2>
          <EmailReadonly email={email} onReset={resetToEmail} />
          {error && <ErrorBanner message={error} />}
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            We&apos;ll send a sign-in link to your email address.
          </p>
          <button
            onClick={handleSendMagicLink}
            disabled={loading}
            className="mb-3 w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Sign-In Link'}
          </button>
          <button
            onClick={() => setStep('password')}
            className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Sign in with password instead
          </button>
        </>
      )}

      {/* Magic Link Sent */}
      {step === 'magic_link_sent' && (
        <div className="text-center py-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30">
            <svg className="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Check your email</h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            We&apos;ve sent a sign-in link to <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>
          </p>
          <p className="text-xs text-slate-400">
            Didn&apos;t receive it? Check your spam folder or{' '}
            <button onClick={resetToEmail} className="text-indigo-600 dark:text-indigo-400 hover:underline">try again</button>
          </p>
        </div>
      )}

      {/* Step 2c/2d: Password */}
      {(step === 'password' || step === 'password_mfa') && (
        <>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Enter your password</h2>
          <EmailReadonly email={email} onReset={resetToEmail} />
          {error && <ErrorBanner message={error} />}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                id="password"
                ref={passwordRef}
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          {method === 'magic_link' && (
            <button
              onClick={() => setStep('magic_link')}
              className="mt-3 w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Use sign-in link instead
            </button>
          )}
        </>
      )}

      {/* Step 3: TOTP Challenge */}
      {step === 'totp' && (
        <>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Two-factor authentication</h2>
          <EmailReadonly email={email} onReset={handleBackToEmail} />
          {error && <ErrorBanner message={error} />}
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Enter the 6-digit code from your authenticator app.
          </p>
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <div>
              <input
                ref={totpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="000000"
              />
              <p className="mt-2 text-xs text-slate-400">
                Open Google Authenticator or your preferred app
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </>
      )}

      {/* Step 4: Remember Device */}
      {step === 'remember_device' && (
        <div className="text-center py-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
            <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Trust this device?</h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            You won&apos;t need to enter a code on this device for 30 days.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSkipTrust}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
            >
              Not Now
            </button>
            <button
              onClick={handleTrustDevice}
              disabled={loading}
              className="flex-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Trust This Device'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmailReadonly({ email, onReset }: { email: string; onReset: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-700/50 px-3 py-2">
      <span className="text-sm text-slate-600 dark:text-slate-300">{email}</span>
      <button
        onClick={onReset}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        Not you?
      </button>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
      {message}
    </div>
  )
}

function usePortalLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/settings/portal-logo')
      .then(r => r.json())
      .then(d => setLogoUrl(d.url || null))
      .catch(() => {})
  }, [])
  return logoUrl
}

export default function LoginPage() {
  const portalLogoUrl = usePortalLogo()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] dark:bg-slate-900">
      <div className="w-full max-w-[400px] px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          {portalLogoUrl ? (
            <img src={portalLogoUrl} alt="Logo" className="h-14 w-auto mb-3" />
          ) : (
            <>
              <img src="/innov8iv-logo.png" alt="Innov8iv" className="h-12 w-auto mb-3" />
              <h1 className="text-xl font-semibold tracking-wide text-slate-400">Engage</h1>
            </>
          )}
        </div>

        <Suspense fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center text-sm text-slate-400">
            Loading...
          </div>
        }>
          <LoginFlow />
        </Suspense>

        {/* Powered by — only shown when custom logo is set */}
        {portalLogoUrl && (
          <div className="mt-8 flex flex-col items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Powered by</span>
            <img src="/innov8iv-logo.png" alt="Innov8iv Engage" className="h-5 w-auto opacity-40" />
          </div>
        )}

        <div className="mt-6 text-center text-[10px] text-slate-300">v{APP_VERSION}</div>
      </div>
    </div>
  )
}
