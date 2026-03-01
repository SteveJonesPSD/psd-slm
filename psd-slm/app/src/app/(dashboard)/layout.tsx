import { Sidebar } from '@/components/sidebar'
import { AuthProvider } from '@/components/auth-provider'
import { ChatPanel } from '@/components/chat-panel'
import { requireAuth } from '@/lib/auth'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireAuth()

  return (
    <AuthProvider user={user}>
      <div className="flex h-screen bg-[#f5f6f8] text-slate-700">
        <Sidebar />
        <main className="flex-1 overflow-auto p-7">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>
      <ChatPanel />
    </AuthProvider>
  )
}
