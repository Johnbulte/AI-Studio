type ToolCardProps = { title: string; detail: string; selected?: boolean; onClick: () => void }

export function ToolCard({ title, detail, selected = false, onClick }: ToolCardProps) {
  return <button aria-pressed={selected} className={`tool-card${selected ? ' selected' : ''}`} onClick={onClick} type="button"><strong>{title}</strong><small>{detail}</small></button>
}
