'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { startMfaEnrolment, confirmMfaEnrolment } from './actions'
import { APP_VERSION } from '@/lib/version'

type MfaStep = 'scan' | 'verify' | 'done'

export default function MfaSetupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] dark:bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    }>
      <MfaSetupFlow />
    </Suspense>
  )
}

function MfaSetupFlow() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const fromSettings = searchParams.get('from') === 'settings'

  const [step, setStep] = useState<MfaStep>('scan')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function enrol() {
      setLoading(true)
      const result = await startMfaEnrolment()
      setLoading(false)
      if (result.error) {
        setError(result.error)
        return
      }
      setFactorId(result.factorId!)
      setQrCode(result.qrCode!)
      setSecret(result.secret!)
    }
    enrol()
  }, [])

  useEffect(() => {
    if (step === 'verify') {
      codeRef.current?.focus()
    }
  }, [step])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setError(null)
    setLoading(true)

    const result = await confirmMfaEnrolment(factorId, code)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setStep('done')
  }

  function handleContinue() {
    if (fromSettings) {
      router.push('/profile/security')
    } else {
      router.push('/')
    }
  }

  function formatSecret(s: string): string {
    return s.replace(/(.{4})/g, '$1 ').trim()
  }

  const stepIndicators = [
    { label: '1. Scan QR code', active: step === 'scan' },
    { label: '2. Enter code', active: step === 'verify' },
    { label: '3. Done', active: step === 'done' },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8] dark:bg-slate-900">
      <div className="w-full max-w-[440px] px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/innov8iv-logo.png" alt="Innov8iv" className="h-12 w-auto mb-3" />
          <h1 className="text-xl font-semibold tracking-wide text-slate-400">Engage</h1>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
            Set up two-factor authentication
          </h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            Add an extra layer of security to your account.
          </p>

          {/* Step indicators */}
          <div className="mb-6 flex gap-2">
            {stepIndicators.map((si, i) => (
              <div
                key={i}
                className={`flex-1 rounded-full py-1.5 text-center text-xs font-medium ${
                  si.active
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : step === 'done' || (step === 'verify' && i === 0)
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-slate-700 text-slate-400'
                }`}
              >
                {si.label}
              </div>
            ))}
          </div>

          {/* Step 1: Scan QR */}
          {step === 'scan' && (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              {loading && !qrCode && (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                </div>
              )}

              {qrCode && (
                <>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <div className="mb-4 flex justify-center">
                    <div className="rounded-lg bg-white p-3">
                      <img src={qrCode} alt="QR Code" className="h-48 w-48" />
                    </div>
                  </div>

                  <div className="mb-5">
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {showSecret ? 'Hide manual code' : "Can't scan? Enter code manually"}
                    </button>
                    {showSecret && secret && (
                      <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-700 p-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Manual entry code:</p>
                        <code className="text-sm font-mono text-slate-900 dark:text-white select-all">
                          {formatSecret(secret)}
                        </code>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setStep('verify')}
                    className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Next
                  </button>
                </>
              )}
            </>
          )}

          {/* Step 2: Verify Code */}
          {step === 'verify' && (
            <>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
                Enter the 6-digit code from your authenticator app to confirm setup.
              </p>
              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3.5 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="000000"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setStep('scan'); setCode(''); setError(null) }}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="flex-1 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
                <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
                Two-factor authentication is now active
              </h3>
              <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
                Your account is now protected with an authenticator app.
              </p>
              <button
                onClick={handleContinue}
                className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                {fromSettings ? 'Back to Settings' : 'Continue to Dashboard'}
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-[10px] text-slate-300">v{APP_VERSION}</div>
      </div>
    </div>
  )
}
