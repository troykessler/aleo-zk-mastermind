import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { endpoint, gamePollInterval, getBoard, isGameId, shortAddress, testnetEndpoint, turnLabel, type Board } from '../aleo/games'
import { useTabTitle } from '../useTabTitle'
import type { GameTransactions } from '../aleo/useGameTransactions'
import ActionButton, { RefreshButton } from '../components/ActionButton'
import GameHistory from '../components/GameHistory'
import PageTitle from '../components/PageTitle'
import TransactionLog from '../components/TransactionLog'
import ExplorerLink from '../components/ExplorerLink'
import PrivateCode from '../components/PrivateCode'
import MastermindBoard, { ColorPalette, PegSlots, usePegSelection } from '../components/MastermindBoard'

function GuessPicker({ id, round, transactions }: { id: string; round: number; transactions: GameTransactions }) {
  const { code, selected, select, pick, ready } = usePegSelection()
  const locked = Boolean(transactions.busyMessage)
  const move = transactions.activeMove
  const busy = move?.kind === 'guess' && move.id === id && move.round === round
  const error = transactions.error
  return <form aria-label="Your guess" className="guess-picker" onSubmit={event => {
    event.preventDefault()
    if (ready && !locked) void transactions.submit({ kind: 'guess', id, round, colors: code })
  }}>
    <p>Choose four colors. Select a socket to change it.</p>
    <PegSlots code={code} selection={{ index: selected, select, locked }} />
    <ColorPalette onPick={pick} disabled={locked} />
    <ActionButton type="submit" disabled={!ready || locked} busy={busy}>
      {busy ? transactions.busyMessage : 'Submit guess with Shield'}
    </ActionButton>
    {error?.move.kind === 'guess' && error.move.id === id && error.move.round === round &&
      <p role="alert" className="error">{error.message}</p>}
  </form>
}

function FeedbackAction({ id, round, transactions }: { id: string; round: number; transactions: GameTransactions }) {
  const move = transactions.activeMove
  const busy = move?.kind === 'feedback' && move.id === id && move.round === round
  return <div className="feedback-action">
    <p>Score this guess using your private solution in Shield.</p>
    <ActionButton busy={busy} disabled={Boolean(transactions.busyMessage)}
      onClick={() => void transactions.submit({ kind: 'feedback', id, round })}>
      {busy ? transactions.busyMessage : 'Give feedback with Shield'}
    </ActionButton>
    {transactions.error?.move.kind === 'feedback' && transactions.error.move.id === id &&
      transactions.error.move.round === round && <p className="error" role="alert">{transactions.error.message}</p>}
  </div>
}

function CopyGameLink() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (status === 'idle') return
    const timer = window.setTimeout(() => setStatus('idle'), status === 'copied' ? 1800 : 5000)
    return () => window.clearTimeout(timer)
  }, [status])

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  return <button className="secondary copy-link" onClick={copy} aria-live="polite"
    aria-label={status === 'copied' ? 'Game link copied' : undefined}>
    <span style={{ visibility: status === 'copied' ? 'hidden' : 'visible' }}>
      {status === 'failed' ? 'Copy the URL from the address bar' : 'Copy game link'}
    </span>
    {status === 'copied' && <span className="copy-check" aria-hidden="true">✓</span>}
  </button>
}

function gameResult({ game, rows }: Board, address: string) {
  const score = rows[game.round - 1]?.pegs
  if (!score) return { title: 'Game complete', detail: 'Waiting for the final score…' }

  const solved = score[1] === 4
  const winner = solved ? 'codebreaker' : 'codemaker'
  const title = address === game[winner] ? `You won as the ${winner}!` : solved ? 'Codebreaker won' : 'Codemaker won'
  const detail = solved
    ? `All four colors were in the right spots on guess ${game.round}.`
    : `The secret code stayed unsolved through all ${game.round} guesses.`
  return { title, detail }
}

export default function GamePage({ address, transactions }: { address: string; transactions: GameTransactions }) {
  const { id = '' } = useParams()
  const valid = isGameId(id)
  const query = useQuery({
    queryKey: ['board', id],
    queryFn: ({ signal, client, queryKey }) => getBoard(id, signal, client.getQueryData(queryKey)),
    enabled: valid,
    refetchInterval: query => {
      const board = query.state.data
      return board?.game.completed && board.rows.every(row => row.guess && row.pegs) ? false : gamePollInterval
    },
    refetchIntervalInBackground: true,
  })
  const board = query.data
  const game = board?.game
  const result = board?.game.completed ? gameResult(board, address) : null
  const role = board?.rows[game?.round ?? 0]?.guess ? 'codemaker' : 'codebreaker'
  let turn = role === 'codemaker' ? 'Codemaker’s turn' : 'Codebreaker’s turn'
  if (result) turn = result.title
  else if (game && address === game[role]) turn = role === 'codebreaker' ? 'Your turn to guess' : 'Your turn to give feedback'
  const waiting = game && !game.completed && address === (role === 'codemaker' ? game.codebreaker : game.codemaker)
  const tabStatus = waiting ? (role === 'codemaker' ? 'Waiting for feedback' : 'Waiting for a guess') : turn
  useTabTitle(game ? tabStatus + ' · ' + turnLabel(game) + ' · Game #' + id : undefined)
  return <>
    <div className="game-heading">
      {valid ? <h1>Game <span className="game-number">#{id}</span></h1> : <PageTitle>Invalid game ID</PageTitle>}
      {game && <dl className="game-players" aria-label="Game players">
        {(['codemaker', 'codebreaker'] as const).map(role => <div key={role}>
          <dt>{role}{address === game[role] && ' (you)'}</dt>
          <dd><ExplorerLink type="address" id={game[role]}>{shortAddress(game[role])}</ExplorerLink></dd>
        </div>)}
      </dl>}
      {valid && <div className="game-actions" key={id}>
        <CopyGameLink />
        {game && <RefreshButton className="secondary" refresh={() => query.refetch({ cancelRefetch: false })}>Refresh board</RefreshButton>}
      </div>}
    </div>
    {!valid ? <p>Open a board using its numeric game ID.</p> : query.isError && !board ?
      <div className="panel"><h2>Board unavailable</h2><p>Check that the Aleo node is running and the program is deployed.</p>
        <RefreshButton className="secondary" refresh={() => query.refetch({ cancelRefetch: false })}>Try again</RefreshButton></div> :
      query.isPending ? <p role="status">Loading board…</p> :
      !board || !game ? <p>This game hasn’t been created on this ledger.</p> :
      <MastermindBoard rows={board.rows} code={game.completed ? game.solution : undefined}
        privateView={!game.completed && address === game.codemaker && endpoint === testnetEndpoint
          ? <PrivateCode key={address + ':' + id} maker={address} id={id} /> : undefined}
        activeRound={game.completed ? undefined : game.round} transactionLog={
          <TransactionLog entries={transactions.entries} stopTracking={transactions.stopTracking}>
            <GameHistory key={id} board={board} />
          </TransactionLog>
        }>
        <div className="panel game-info">
          <div className="tray-label game-turn">{turnLabel(game)}</div>
          <h2 aria-live="polite">{turn}</h2>
          {result ? <p>{result.detail}</p> :
            address !== game[role] ? <p>{role === 'codebreaker' ? 'Waiting for the codebreaker’s next guess.' : 'Waiting for the codemaker’s feedback.'}</p> :
            endpoint !== testnetEndpoint ? <p>Playing a turn with Shield requires the public testnet.</p> :
            role === 'codemaker' ? <FeedbackAction id={id} round={game.round} transactions={transactions} /> :
            <GuessPicker key={id + ':' + game.round + ':' + address} id={id} round={game.round} transactions={transactions} />}
          {query.isError && <p role="alert" className="error">Couldn’t refresh the board. Showing the last known turn.</p>}
        </div>
      </MastermindBoard>}
  </>
}
