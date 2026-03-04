'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from '@/app/auth/actions'

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/'
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    formData.set('redirect', redirectTo)

    const result = await signIn(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-slate-900">Sign in</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="you@psdgroup.co.uk"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

      {/* SSO placeholder */}
      <div className="mt-5 border-t border-slate-100 pt-5">
        <button
          disabled
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
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
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
      <div className="w-full max-w-[400px] px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <img src="/innov8iv-logo.png" alt="Innov8iv" className="h-12 w-auto mb-3" />
          <h1 className="text-xl font-semibold tracking-wide text-slate-400">Engage</h1>
        </div>

        <Suspense fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center text-sm text-slate-400">
            Loading...
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
