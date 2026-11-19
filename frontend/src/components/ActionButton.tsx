import { useState, type ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }

export default function ActionButton({ busy, disabled, children, ...props }: Props) {
  return <button {...props} disabled={disabled || busy} aria-busy={busy || undefined}>
    {busy && <span className="button-spinner" aria-hidden="true" />}{children}
  </button>
}

export function RefreshButton({ refresh, children, className = 'text-button' }: {
  refresh: () => Promise<unknown>; children: string; className?: string
}) {
  const [busy, setBusy] = useState(false)
  return <ActionButton className={className} busy={busy} onClick={async () => {
    setBusy(true)
    try { await refresh() } finally { setBusy(false) }
  }}>{children}</ActionButton>
}
