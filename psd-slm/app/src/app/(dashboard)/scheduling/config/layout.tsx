'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { label: 'Job Types', href: '/scheduling/config/job-types' },
  { label: 'Task Templates', href: '/scheduling/config/task-templates' },
]

export default function SchedulingConfigLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <div className="mb-6">
        <Link href="/scheduling" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Back to Scheduling
        </Link>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-1">Scheduling Configuration</h2>
      <p className="text-sm text-slate-400 mb-6">Manage job types and task templates</p>

      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map(tab => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px no-underline transition-colors ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
