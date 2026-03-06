import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { requirePortalSession } from '@/lib/portal/session'
import { getPortalBranding } from '@/lib/settings'
import { getAgentAvatars } from '@/lib/agent-avatars'
import { PortalProvider } from './portal-context'
import { PortalNav } from './portal-nav'
import { PortalChatPanel } from './portal-chat-panel'

// Routes under /portal that render without a session (login, auth callbacks)
const PORTAL_PUBLIC_PATHS = ['/portal/login', '/portal/auth/']

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  // Let public portal pages render without session (avoids redirect loop)
  const isPublicPortalPath = PORTAL_PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (isPublicPortalPath) {
    return <>{children}</>
  }

  let ctx
  try {
    ctx = await requirePortalSession()
  } catch {
    redirect('/portal/login')
  }

  const [branding, agentAvatars] = await Promise.all([
    getPortalBranding(ctx.orgId),
    getAgentAvatars(ctx.orgId),
  ])

  return (
    <PortalProvider value={{ ...ctx, portalLogoUrl: branding.logoUrl, orgName: branding.orgName, agentAvatars }}>
      <div className="min-h-screen bg-[#f5f6f8] dark:bg-slate-900 text-slate-700 dark:text-slate-200">
        <PortalNav />

        <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-10 lg:py-12">
          {children}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span>{branding.orgName} &middot; Customer Portal</span>
            {branding.logoUrl && (
              <>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="text-[11px] text-slate-300 dark:text-slate-600">Powered by</span>
                <img src="/innov8iv-logo.png" alt="Innov8iv Engage" className="h-4 w-auto opacity-30" />
              </>
            )}
          </div>
        </footer>

        <PortalChatPanel />
      </div>
    </PortalProvider>
  )
}
