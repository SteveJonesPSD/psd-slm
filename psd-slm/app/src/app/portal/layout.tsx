import { getPortalContact } from '@/lib/portal/auth'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const contact = await getPortalContact()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-extrabold text-white">
              i8
            </div>
            <span className="text-sm font-semibold text-slate-800">Support Portal</span>
          </div>
          {contact ? (
            <div className="flex items-center gap-4">
              <nav className="flex gap-4">
                <a href="/portal/tickets" className="text-sm text-slate-600 hover:text-slate-900 no-underline">
                  Tickets
                </a>
                <a href="/portal/knowledge-base" className="text-sm text-slate-600 hover:text-slate-900 no-underline">
                  Knowledge Base
                </a>
                {contact.is_overseer && (
                  <a href="/portal/dashboard" className="text-sm text-slate-600 hover:text-slate-900 no-underline">
                    Dashboard
                  </a>
                )}
              </nav>
              <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                <span className="text-xs text-slate-500">{contact.first_name} {contact.last_name}</span>
                <form action="/api/auth/signout" method="post">
                  <button type="submit" className="text-xs text-slate-400 hover:text-slate-600">
                    Logout
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4 text-center text-xs text-slate-400">
          PSD Group Ltd · Support Portal · Need help? Call 0800 123 4567
        </div>
      </footer>
    </div>
  )
}
