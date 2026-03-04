import { Sidebar } from '@/components/sidebar'
import { AuthProvider } from '@/components/auth-provider'
import { ChatPanel } from '@/components/chat-panel'
import { SidebarProvider } from '@/components/sidebar-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { MobileHeader } from '@/components/mobile-header'
import { requireAuth } from '@/lib/auth'
import { getAgentAvatars } from '@/lib/agent-avatars'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()
  const agentAvatars = await getAgentAvatars(user.orgId)

  return (
    <AuthProvider user={user}>
      <ThemeProvider initialTheme={user.themePreference}>
        <SidebarProvider>
          <div className="flex h-screen bg-[#f5f6f8] dark:bg-slate-900 text-slate-700 dark:text-slate-200">
            <Sidebar agentAvatars={agentAvatars} />
            <div className="flex-1 flex flex-col overflow-hidden">
              <MobileHeader />
              <main className="flex-1 overflow-auto px-4 py-4 md:px-8 md:py-6 lg:px-12 lg:py-8">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
        <ChatPanel agentAvatars={agentAvatars} />
      </ThemeProvider>
    </AuthProvider>
  )
}
