type WorkflowStepProps = { number: string; title: string; detail: string; active?: boolean }

export function WorkflowStep({ number, title, detail, active = false }: WorkflowStepProps) {
  return <article className={`workflow-step${active ? ' active' : ''}`}><span className="step-number">{number}</span><strong>{title}</strong><span>{detail}</span></article>
}
