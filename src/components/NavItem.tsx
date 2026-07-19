type NavItemProps = { label: string; selected?: boolean; onClick: () => void }

export function NavItem({ label, selected = false, onClick }: NavItemProps) {
  return <button aria-pressed={selected} className={`nav-item${selected ? ' selected' : ''}`} onClick={onClick} type="button">{label}</button>
}
