import { useCallback, useEffect, useRef, useState } from 'react'
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { isSuccessfulTransactionStatus, isTerminalTransactionStatus } from '@provablehq/aleo-types'
import { useLocation, useNavigate } from 'react-router-dom'
import { gamePollInterval, getGame, getGuess } from './games'
import { readPending, savePending, type PendingTransaction } from './pendingTransaction'
import { isShieldLocked, transactionStatus, submitGame, submitGuess, submitFeedback } from './useShield'

type Move =
  | { kind: 'create'; breaker: string; colors: number[] }
  | { kind: 'guess'; id: string; round: number; colors: number[] }
  | { kind: 'feedback'; id: string; round: number }

type MoveRef = { kind: 'create' } | { kind: 'guess' | 'feedback'; id: string; round: number }
export type LogEntry = { time: number; message: string; transactionId?: string }

type Outcome = 'pending' | 'confirmed' | 'failed'

async function checkMove(move: PendingTransaction, address: string, signal: AbortSignal): Promise<Outcome> {
  if (move.kind === 'guess') {
    const guess = await getGuess(move.id, move.round, signal)
    if (!guess) return 'pending'
    return guess.every((color, i) => color === move.colors[i]) ? 'confirmed' : 'failed'
  }
  const game = await getGame(move.id, signal)
  if (!game) return 'pending'
  if (move.kind === 'create') {
    return game.codemaker === address && game.codebreaker === move.breaker ? 'confirmed' : 'failed'
  }
  return game.round > move.round ? 'confirmed' : 'pending'
}

export function useGameTransactions(address: string) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data: pending } = useQuery({
    queryKey: ['pending-transaction', address],
    queryFn: skipToken,
    initialData: () => readPending(address),
  })
  const setPending = useCallback((receipt: PendingTransaction | null) => {
    savePending(address, receipt)
    client.setQueryData(['pending-transaction', address], receipt)
  }, [address, client])
  const requesting = useRef(false)
  const [submitting, setSubmitting] = useState<MoveRef | null>(null)
  const [error, setError] = useState<{ move: MoveRef; message: string } | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const log = useCallback((message: string, transactionId?: string) => {
    const entry = { time: Date.now(), message, transactionId }
    setEntries(previous => {
      const last = previous[0]
      if (last?.message === message && last.transactionId === transactionId) return previous
      return [entry, ...previous].slice(0, 50)
    })
  }, [])

  const confirmation = useQuery({
    queryKey: ['game-transaction', address, pending?.transactionId],
    enabled: Boolean(pending),
    queryFn: async ({ signal }) => {
      if (!pending) throw new Error('Missing transaction.')
      const result = await transactionStatus(pending.transactionId)
      let outcome: Outcome = 'pending'
      if (isSuccessfulTransactionStatus(result.status)) {
        outcome = await checkMove(pending, address, signal)
      } else if (isTerminalTransactionStatus(result.status)) {
        outcome = 'failed'
      }
      return { outcome, status: result.status, transactionId: result.transactionId || pending.transactionId }
    },
    refetchInterval: gamePollInterval,
  })

  useEffect(() => {
    const result = confirmation.data
    if (!pending || !result) return
    const action = { create: 'Game #', guess: 'Guess for game #', feedback: 'Feedback for game #' }
    const label = action[pending.kind] + pending.id
    const message = result.outcome === 'confirmed' ? label + ' confirmed'
      : result.outcome === 'failed' ? label + ' failed (' + result.status + ')' : 'Shield · ' + result.status
    log(message, result.transactionId)
    if (result.outcome === 'pending') return
    setPending(null)
    void client.invalidateQueries({ queryKey: ['board', pending.id] })
    void client.invalidateQueries({ queryKey: ['active', address] })
    if (result.outcome === 'failed') {
      setError({ move: pending, message: label + ' failed. Check Shield for details, then try again.' })
    } else if (pending.kind === 'create' && (pathname === '/' || pathname === '/new')) {
      navigate('/game/' + pending.id, { replace: true })
    }
  }, [address, client, confirmation.data, log, navigate, pathname, pending, setPending])

  async function submit(move: Move) {
    if (!address || requesting.current || client.getQueryData(['pending-transaction', address])) return
    requesting.current = true
    const moveRef: MoveRef = move.kind === 'create' ? { kind: 'create' } : { kind: move.kind, id: move.id, round: move.round }
    setSubmitting(moveRef)
    setError(null)
    const label = move.kind === 'create' ? 'game creation' : move.kind + ' for game #' + move.id
    log('Starting ' + label)
    try {
      let request: PendingTransaction
      if (move.kind === 'create') {
        const result = await submitGame(address, move.breaker, move.colors)
        request = { kind: 'create', ...result }
      } else {
        const result = move.kind === 'feedback'
          ? await submitFeedback(address, move.id, move.round)
          : await submitGuess(address, move.id, move.round, move.colors)
        request = { ...move, transactionId: result.transactionId }
      }
      log('Shield request received', request.transactionId)
      setPending(request)
    } catch (cause) {
      if (isShieldLocked(cause)) return
      const message = cause instanceof Error ? cause.message : 'Couldn’t submit the transaction to Shield.'
      setError({ move: moveRef, message })
      log('Unsuccessful ' + label)
      if (move.kind !== 'create') void client.invalidateQueries({ queryKey: ['board', move.id] })
    } finally {
      requesting.current = false
      setSubmitting(null)
    }
  }

  const busyMessage = submitting ? 'Waiting for Shield…' : !pending ? '' : confirmation.isError
    ? 'Waiting for transaction status. Check Shield for progress.' : 'Waiting for confirmation…'
  function stopTracking() {
    if (!pending) return
    log('Stopped tracking game #' + pending.id + '. Check Shield before submitting again.', pending.transactionId)
    setPending(null)
  }
  return { entries, submit, error, busyMessage, activeMove: submitting ?? pending,
    stopTracking: pending && confirmation.isError ? stopTracking : undefined }
}

export type GameTransactions = ReturnType<typeof useGameTransactions>
