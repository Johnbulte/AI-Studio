type RecentWorkItemProps = {
  title: string
  detail: string
  tone: 'lilac' | 'coral' | 'cyan'
}

export function RecentWorkItem({ title, detail, tone }: RecentWorkItemProps) {
  return <article className="recent-work-item">
    <div aria-hidden="true" className={`recent-work-preview tone-${tone}`} />
    <div><strong>{title}</strong><small>{detail}</small></div>
  </article>
}
