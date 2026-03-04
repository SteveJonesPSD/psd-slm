import { requireAuth } from '@/lib/auth'
import { AuthProvider } from '@/components/auth-provider'

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  return (
    <AuthProvider user={user}>
      <div className="min-h-screen bg-white">
        {/* Minimal header for field view */}
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                <span className="text-white font-bold text-[11px]">i8</span>
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900">Engage</span>
                <span className="ml-1.5 text-[10px] font-medium text-slate-400">Field</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-white overflow-hidden"
                style={{ backgroundColor: user.color || '#6366f1' }}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full object-cover" />
                ) : (
                  user.initials || (user.firstName[0] + user.lastName[0])
                )}
              </div>
              <span className="text-sm font-medium text-slate-700">{user.firstName}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-4 py-4">
          {children}
        </main>
      </div>
    </AuthProvider>
  )
}
