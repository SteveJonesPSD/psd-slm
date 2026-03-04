export default function CollectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 text-sm font-bold text-white">
            i8
          </div>
          <div>
            <div className="text-sm font-semibold">Innov8iv Engage</div>
            <div className="text-xs text-slate-400">Stock Collection</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
