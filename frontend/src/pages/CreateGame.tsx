import { useState, type FormEvent, type ReactNode } from 'react'
import { endpoint, testnetEndpoint } from '../aleo/games'
import type { GameTransactions } from '../aleo/useGameTransactions'
import ExternalLinkIcon from '../components/ExternalLinkIcon'
import ActionButton from '../components/ActionButton'
import PageTitle from '../components/PageTitle'
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

  return <>
    <PageTitle>Set your code</PageTitle>
    <MastermindBoard code={code} selection={{ index: selected, select, locked }}
      paletteControl={<ColorPalette onPick={pick} disabled={locked} />} transactionLog={children}>
      <section className="panel setup-panel">
        <p>Pick four pegs from the palette. Colors can repeat. Select a socket to change it.</p>
        {!address && <section className="first-game-guide">
          <h2>Before your first game</h2>
          <ol>
            <li>Install the <a className="explorer-link" href="https://www.shield.app/" target="_blank" rel="noopener noreferrer">Shield Wallet browser extension <ExternalLinkIcon /></a>.</li>
            <li>Create an account in Shield and select Aleo Testnet.</li>
            <li>Open the <a className="explorer-link" href="https://faucet.aleo.org/" target="_blank" rel="noopener noreferrer">Aleo testnet faucet <ExternalLinkIcon /></a>, connect Shield, and request credits. Both players use credits to submit moves.</li>
            <li>Pick four colors on the board and connect Shield to create your game. If a friend invited you, open their game link and connect to guess.</li>
          </ol>
        </section>}
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
  </>
}
