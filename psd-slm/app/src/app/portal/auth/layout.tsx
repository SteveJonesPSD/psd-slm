export default function PortalAuthLayout({ children }: { children: React.ReactNode }) {
  // Auth callback pages bypass the main portal layout (no session required)
  return <>{children}</>
}
