import { Sidebar } from '@/components/sidebar'
import { AuthProvider } from '@/components/auth-provider'
import { ChatPanel } from '@/components/chat-panel'
import { SidebarProvider } from '@/components/sidebar-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { MobileHeader } from '@/components/mobile-header'
import { requireAuth } from '@/lib/auth'
import { getAgentAvatars } from '@/lib/agent-avatars'
import { EmailPoller } from '@/components/email-poller'
import { SessionRefresh } from '@/components/session-refresh'
import { getAutoPollingEnabled } from '@/lib/email/actions'
import { getPortalLogoUrl } from '@/lib/settings'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const [agentAvatars, autoPollingEnabled, portalLogoUrl] = await Promise.all([
    getAgentAvatars(user.orgId),
    getAutoPollingEnabled(),
    getPortalLogoUrl(user.orgId),
  ])

  return (
    <AuthProvider user={user}>
      <ThemeProvider initialTheme={user.themePreference}>
        <SidebarProvider>
          <div className="flex h-screen bg-[#f5f6f8] dark:bg-slate-900 text-slate-700 dark:text-slate-200">
            <Sidebar agentAvatars={agentAvatars} portalLogoUrl={portalLogoUrl} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <MobileHeader portalLogoUrl={portalLogoUrl} />
              <main className="flex-1 overflow-auto px-6 py-8 md:px-10 md:py-10 lg:px-12 lg:py-12">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
        <ChatPanel agentAvatars={agentAvatars} />
        <EmailPoller enabled={autoPollingEnabled} />
        <SessionRefresh />
      </ThemeProvider>
    </AuthProvider>
  )
}
