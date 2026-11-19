import type { ReactNode } from 'react'
import { endpoint, testnetEndpoint } from '../aleo/games'
import ExternalLinkIcon from './ExternalLinkIcon'

export default function ExplorerLink({ type, id, children }: {
  type: 'address' | 'program'; id: string; children: ReactNode
}) {
  if (endpoint !== testnetEndpoint) return <span title={id}>{children}</span>
  return <a className="explorer-link"
    href={`https://testnet.explorer.provable.com/${type}/${encodeURIComponent(id)}`}
    target="_blank" rel="noopener noreferrer" title={id}
    aria-label={`View ${type} ${id} on the testnet explorer (opens in a new tab)`}>
    {children}<ExternalLinkIcon />
  </a>
}
