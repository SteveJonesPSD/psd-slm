import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { createAdminClient } from '@/lib/supabase/admin'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

export async function generateMetadata(): Promise<Metadata> {
  let iconUrl: string | null = null

  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('org_settings')
      .select('setting_value')
      .eq('category', 'general')
      .eq('setting_key', 'webapp_icon_url')
      .limit(1)
      .maybeSingle()

    if (data?.setting_value) iconUrl = data.setting_value
  } catch {
    // Fall back to defaults
  }

  const appleIcon = iconUrl || '/favicon.ico'

  return {
    title: 'Innov8iv Engage',
    description: 'Sales pipeline, quoting, orders, and commission tracking',
    manifest: '/api/manifest',
    icons: {
      icon: iconUrl || '/favicon.ico',
      apple: [
        { url: appleIcon, sizes: '180x180' },
        { url: appleIcon, sizes: '152x152' },
        { url: appleIcon, sizes: '120x120' },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
    },
    other: {
      'mobile-web-app-capable': 'yes',
    },
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1e293b" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})()` }} />
      </head>
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
