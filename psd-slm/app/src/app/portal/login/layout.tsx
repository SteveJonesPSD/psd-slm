export default function PortalLoginLayout({ children }: { children: React.ReactNode }) {
  // Login page bypasses the main portal layout (no session required)
  return <>{children}</>
}
