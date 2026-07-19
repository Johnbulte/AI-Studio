import type { ReactNode } from 'react'

type PanelProps = { title: string; children: ReactNode; action?: ReactNode }

export function Panel({ title, children, action }: PanelProps) {
  return <section className="panel"><header className="panel-header"><h2 className="panel-title">{title}</h2>{action}</header><div className="panel-body">{children}</div></section>
}
