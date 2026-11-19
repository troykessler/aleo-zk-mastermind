import type { QueryClient } from '@tanstack/react-query'
import { byteArray, endpoint, programId, type Board } from './games'

const callsUrl = 'https://api.provable.com/v2/testnet/programs/' + encodeURIComponent(programId) + '/latest-calls/paginated'
const functions = ['codemaker_create_game', 'codebreaker_guess', 'codemaker_feedback']
type Call = { transaction_id: string; function_id: string; status: string; block_number: number; block_timestamp: string }
type Cursor = { block_number: number; transition_id: string }
type CallPage = { calls: Call[]; next_cursor?: Cursor }
type Transition = { program: string; function: string; inputs: { value?: string }[]; outputs: { type: string; value?: string }[] }
type Move = { game: string; kind: 'create' | 'guess' | 'feedback'; colors?: number[]; round?: number; index: number; position: number }
type Stamp = Move & { tx: string; block: number; time: number }

async function json(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) })
  if (!response.ok) throw new Error('Explorer history unavailable.')
  return response.json()
}

async function transactionMoves(tx: string, signal: AbortSignal): Promise<Move[]> {
  const result = await json(endpoint + '/testnet/transaction/confirmed/' + tx, signal)
  if (result.status !== 'accepted' || result.transaction?.id !== tx) return []
  const moves: Move[] = []
  const transitions: Transition[] = result.transaction.execution?.transitions ?? []
  transitions.forEach((transition, position) => {
    if (transition.program !== programId || !functions.includes(transition.function)) return
    const order = { index: result.index as number, position }
    if (transition.function === 'codemaker_create_game') {
      // The game ID is the first public finalize argument. The input itself is private.
      const future = transition.outputs.find(output => output.type === 'future')?.value
      const game = /\barguments:\s*\[\s*(\d+)u64\s*,/.exec(future ?? '')?.[1]
      if (game) moves.push({ ...order, game, kind: 'create' })
      return
    }
    const game = /^(\d+)u64$/.exec(transition.inputs[0]?.value ?? '')?.[1]
    if (!game) return
    if (transition.function === 'codebreaker_guess') {
      const colors = byteArray(transition.inputs[1]?.value ?? '', 4, 5)
      moves.push({ ...order, game, kind: 'guess', colors })
    } else {
      const round = /\bround:\s*(\d+)u8/.exec(transition.inputs[1]?.value ?? '')
      if (round) moves.push({ ...order, game, kind: 'feedback', round: Number(round[1]) })
    }
  })
  return moves
}

export async function getGameHistory(client: QueryClient, board: Board, signal: AbortSignal, previous: Stamp[] = []): Promise<Stamp[]> {
  const moves = new Map(previous.map(move => [move.tx + ':' + move.position, move]))
  let stopBelow = 0
  for (const row of historyRows(board, previous)) {
    if (!row.stamp) break
    stopBelow = row.stamp.block
  }
  let cursor: Cursor | undefined
  const limit = 20
  do {
    const params = new URLSearchParams({ limit: String(limit), sort: 'desc' })
    if (cursor) {
      params.set('cursor_block_number', String(cursor.block_number))
      params.set('cursor_transition_id', cursor.transition_id)
    }
    const url = callsUrl + '?' + params
    const page: CallPage = cursor ? await client.fetchQuery({
      queryKey: ['program-call-page', url], staleTime: 60000,
      queryFn: ({ signal }) => json(url, signal),
    }) : await json(url, signal)
    const calls = page.calls.filter(call => call.block_number >= stopBelow && call.status.toLowerCase() === 'accepted'
      && functions.includes(call.function_id) && /^at1[a-z0-9]{58}$/.test(call.transaction_id))
    for (let offset = 0; offset < calls.length; offset += 4) {
      signal.throwIfAborted()
      await Promise.all(calls.slice(offset, offset + 4).map(async call => {
        const tx = call.transaction_id
        const actions = await client.fetchQuery({
          queryKey: ['confirmed-moves', endpoint, programId, tx], staleTime: Infinity,
          queryFn: ({ signal }) => transactionMoves(tx, signal),
        })
        const time = Number(call.block_timestamp) * 1000
        if (!Number.isFinite(time) || time <= 0) return
        for (const action of actions.filter(move => move.game === board.game.id)) {
          const key = tx + ':' + action.position
          if (!moves.has(key)) moves.set(key, { ...action, tx, block: call.block_number, time })
          if (action.kind === 'create') stopBelow = Math.max(stopBelow, call.block_number)
        }
      }))
    }
    if (page.calls.length < limit || page.calls[page.calls.length - 1].block_number < stopBelow) break
    const next = page.next_cursor
    if (next && next.transition_id === cursor?.transition_id) throw new Error('Explorer pagination stalled.')
    cursor = next
  } while (cursor)
  const ordered = [...moves.values()].sort((a, b) => a.block - b.block || a.index - b.index || a.position - b.position)
  // The guess transition omits its round. Assign rounds only once the entire
  // sequence agrees with the board, including repeated guesses in the same block.
  const guesses = ordered.filter(move => move.kind === 'guess')
  const count = board.game.round + (board.rows[board.game.round]?.guess ? 1 : 0)
  const confirmed = board.rows.slice(0, count)
  if (confirmed.length === count && count === guesses.length && confirmed.every((row, i) =>
    row.guess?.every((color, j) => color === guesses[i].colors?.[j]))) {
    let round = 0
    return ordered.map(move => move.kind === 'guess' ? { ...move, round: round++ } : move)
  }
  return ordered
}

export function historyRows(board: Board, moves: Stamp[] = []) {
  const rows: { key: string; text: string; stamp?: Stamp }[] = [
    { key: 'created', text: 'Codemaker created the game', stamp: moves.find(move => move.kind === 'create') },
  ]
  board.rows.forEach(({ guess, pegs }, round) => {
    if (guess) {
      const stamp = moves.find(move => move.kind === 'guess' && move.round === round)
      rows.push({ key: 'guess-' + round, text: 'Codebreaker submitted guess ' + (round + 1), stamp })
    }
    if (!pegs) return
    const stamp = moves.find(move => move.kind === 'feedback' && move.round === round)
    rows.push({ key: 'feedback-' + round, text: 'Codemaker scored guess ' + (round + 1) + ' · ' + pegs[1] + ' exact, ' + pegs[0] + ' color only', stamp })
    if (board.game.completed && round + 1 === board.game.round) {
      rows.push({ key: 'complete', text: pegs[1] === 4 ? 'Codebreaker solved the code' : 'Codemaker won after ten guesses', stamp })
    }
  })
  return rows
}
