type ActionButtonProps = { children: string; disabled?: boolean; onClick: () => void }

export function ActionButton({ children, disabled = false, onClick }: ActionButtonProps) {
  return <button aria-busy={disabled} className="action-button" disabled={disabled} onClick={onClick} type="button">{children}</button>
}
