import type { ReactNode } from 'react'

export function ResponsiveShell({ children }: { children: ReactNode }) {
  return <div className="responsive-shell">{children}</div>
}
