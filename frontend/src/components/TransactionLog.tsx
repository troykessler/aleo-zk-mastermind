import type { ReactNode } from 'react'
import { endpoint, testnetEndpoint } from '../aleo/games'
import type { LogEntry } from '../aleo/useGameTransactions'

function TransactionId({ id }: { id: string }) {
  const short = id.length > 23 ? id.slice(0, 11) + '…' + id.slice(-8) : id
  if (endpoint === testnetEndpoint && /^at1[a-z0-9]{58}$/.test(id)) {
    return <a href={'https://testnet.explorer.provable.com/transaction/' + id} target="_blank"
      rel="noopener noreferrer" title={id}>{short}</a>
  }
  return <code title={id}>{short}</code>
}

export default function TransactionLog({ entries, stopTracking, children }: {
  entries: LogEntry[]; stopTracking?: () => void; children?: ReactNode
}) {
  return <section className="panel console" aria-label="Aleo transaction log">
    <div className="section-heading"><h2>Transaction log</h2><span className="terminal-glyph" aria-hidden="true">›_</span></div>
    <div className="console-body" role="log" aria-live="polite">
      {entries.length === 0 && <p className="idle">Waiting for a transaction<span aria-hidden="true">_</span></p>}
      {entries.map((entry, index) => <div className="log-row" key={entries.length - index + ':' + entry.time}>
        <time dateTime={new Date(entry.time).toISOString()}>{new Date(entry.time).toLocaleTimeString([], {hour12:false})}</time>
        <div>{entry.message}{entry.transactionId && <> · <TransactionId id={entry.transactionId} /></>}</div>
      </div>)}
      {stopTracking && <div>
        <p>Status unavailable. Check Shield before submitting another move.</p>
        <button className="text-button" onClick={stopTracking}>Stop tracking this transaction</button>
      </div>}
    </div>
    {children}
  </section>
}
