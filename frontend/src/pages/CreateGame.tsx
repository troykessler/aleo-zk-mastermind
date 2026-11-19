import { useState, type FormEvent, type ReactNode } from 'react'
import { endpoint, testnetEndpoint } from '../aleo/games'
import type { GameTransactions } from '../aleo/useGameTransactions'
import ActionButton from '../components/ActionButton'
import MastermindBoard, { ColorPalette, usePegSelection } from '../components/MastermindBoard'

export default function CreateGame({ address, connect, busy, transactions, children }: {
  address: string; connect: () => void; busy: boolean; transactions: GameTransactions; children: ReactNode
}) {
  const [breaker, setBreaker] = useState('')
  const { code, selected, select, pick, ready } = usePegSelection()
  const locked = Boolean(transactions.busyMessage)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (ready && address && endpoint === testnetEndpoint) void transactions.submit({ kind: 'create', breaker: breaker.trim(), colors: code })
  }

  return <MastermindBoard code={code} selection={{ index: selected, select, locked }}
    paletteControl={<ColorPalette onPick={pick} disabled={locked} />} transactionLog={children}>
    <section className="panel setup-panel">
      <h1>Set your code<span>.</span></h1>
      <p>Pick four pegs from the palette. Colors can repeat. Select a socket to change it.</p>
      <form className="invite" onSubmit={submit}>
        {!ready ? <p className="setup-hint">Fill the secret row to invite a codebreaker.</p> :
          endpoint !== testnetEndpoint ? <p>Creating a game with Shield requires public testnet.</p> :
          !address ? <><p role="status">Code ready. Connect your codemaker wallet to continue.</p>
            <ActionButton type="button" onClick={connect} busy={busy}>{busy ? 'Connecting…' : 'Connect Shield'}</ActionButton></> :
          <><label htmlFor="breaker">Codebreaker’s Aleo address</label>
            <input id="breaker" value={breaker} onChange={e => setBreaker(e.target.value)} placeholder="aleo1…"
              disabled={locked} required autoCapitalize="none" spellCheck={false} autoComplete="off" />
            <ActionButton type="submit" disabled={!breaker.trim() || locked} busy={transactions.activeMove?.kind === 'create'}>
              {transactions.activeMove?.kind === 'create' ? transactions.busyMessage : 'Create game with Shield'}
            </ActionButton></>}
        {transactions.error?.move.kind === 'create' && <p role="alert" className="error">{transactions.error.message}</p>}
      </form>
    </section>
  </MastermindBoard>
}
