import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isSuccessfulTransactionStatus, isTerminalTransactionStatus } from '@provablehq/aleo-types'
import { useLocation, useNavigate } from 'react-router-dom'
import { getGame, getGuess } from './games'
import { transactionStatus, submitGame, submitGuess, submitFeedback } from './useShield'

type Move =
  | { kind: 'create'; breaker: string; colors: number[] }
  | { kind: 'guess'; id: string; round: number; colors: number[] }
  | { kind: 'feedback'; id: string; round: number }

type MoveRef = { kind: 'create' } | { kind: 'guess' | 'feedback'; id: string; round: number }
type Pending = { id: string; transactionId: string } & (
  { kind: 'create'; breaker: string } | Exclude<Move, { kind: 'create' }>
)
export type LogEntry = { time: number; message: string; transactionId?: string }

export function useGameTransactions(address: string) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [pending, setPending] = useState<Pending | null>(null)
  const [submitting, setSubmitting] = useState<MoveRef | null>(null)
  const [error, setError] = useState<{ move: MoveRef; message: string } | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])

  const confirmation = useQuery({
    queryKey: ['game-transaction', address, pending?.transactionId],
    enabled: Boolean(pending),
    queryFn: async ({ signal }) => {
      if (!pending) throw new Error('Missing transaction.')
      const result = await transactionStatus(pending.transactionId)
      let outcome: 'pending' | 'confirmed' | 'failed' = 'pending'
      if (isSuccessfulTransactionStatus(result.status)) {
        if (pending.kind === 'create') {
          const game = await getGame(pending.id, signal)
          if (game) outcome = game.codemaker === address && game.codebreaker === pending.breaker ? 'confirmed' : 'failed'
        } else if (pending.kind === 'guess') {
          const guess = await getGuess(pending.id, pending.round, signal)
          if (guess) outcome = guess.every((color, i) => color === pending.colors[i]) ? 'confirmed' : 'failed'
        } else {
          const game = await getGame(pending.id, signal)
          if (game && game.round > pending.round) outcome = 'confirmed'
        }
      } else if (isTerminalTransactionStatus(result.status)) {
        outcome = 'failed'
      }
      return { outcome, status: result.status, transactionId: result.transactionId || pending.transactionId }
    },
    refetchInterval: 5000,
  })

  useEffect(() => {
    const result = confirmation.data
    if (!pending || !result) return
    const action = { create: 'Game #', guess: 'Guess for game #', feedback: 'Feedback for game #' }
    const label = action[pending.kind] + pending.id
    const message = result.outcome === 'confirmed' ? label + ' confirmed'
      : result.outcome === 'failed' ? label + ' failed (' + result.status + ')' : 'Shield · ' + result.status
    setEntries(previous => {
      const last = previous[0]
      if (last?.message === message && last.transactionId === result.transactionId) return previous
      return [{ time: Date.now(), message, transactionId: result.transactionId }, ...previous].slice(0, 50)
    })
    if (result.outcome === 'pending') return
    setPending(null)
    void client.invalidateQueries({ queryKey: ['board', pending.id] })
    void client.invalidateQueries({ queryKey: ['active', address] })
    if (result.outcome === 'failed') {
      setError({ move: pending, message: label + ' failed. Check Shield for details, then try again.' })
    } else if (pending.kind === 'create' && (pathname === '/' || pathname === '/new')) {
      navigate('/game/' + pending.id, { replace: true })
    }
  }, [address, client, confirmation.data, navigate, pathname, pending])

  async function submit(move: Move) {
    if (!address || submitting || pending) return
    setSubmitting(move.kind === 'create' ? { kind: 'create' } : { kind: move.kind, id: move.id, round: move.round })
    setError(null)
    const label = move.kind === 'create' ? 'game creation' : move.kind + ' for game #' + move.id
    setEntries(previous => [{ time: Date.now(), message: 'Starting ' + label }, ...previous].slice(0, 50))
    try {
      let request: Pending
      if (move.kind === 'create') {
        const result = await submitGame(address, move.breaker, move.colors)
        request = { kind: 'create', ...result }
      } else {
        const result = move.kind === 'feedback'
          ? await submitFeedback(address, move.id, move.round)
          : await submitGuess(address, move.id, move.round, move.colors)
        request = { ...move, transactionId: result.transactionId }
      }
      setEntries(previous => [{ time: Date.now(), message: 'Shield request received', transactionId: request.transactionId }, ...previous].slice(0, 50))
      setPending(request)
    } catch (cause) {
      setError({ move: move.kind === 'create' ? { kind: 'create' } : move, message: cause instanceof Error ? cause.message : 'Couldn’t submit the transaction to Shield.' })
      setEntries(previous => [{ time: Date.now(), message: 'Unsuccessful ' + label }, ...previous].slice(0, 50))
      if (move.kind !== 'create') void client.invalidateQueries({ queryKey: ['board', move.id] })
    } finally {
      setSubmitting(null)
    }
  }

  const busyMessage = submitting ? 'Waiting for Shield…' : !pending ? '' : confirmation.isError
    ? 'Waiting for transaction status. Check Shield for progress.' : 'Waiting for testnet confirmation…'
  return { entries, submit, error, busyMessage, activeMove: submitting ?? pending }
}

export type GameTransactions = ReturnType<typeof useGameTransactions>
