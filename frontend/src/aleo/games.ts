import { queryOptions } from '@tanstack/react-query'

export const testnetEndpoint = 'https://api.explorer.provable.com/v1'
export const endpoint = (import.meta.env.VITE_ALEO_ENDPOINT || testnetEndpoint).replace(/\/+$/, '')
export const programId = import.meta.env.VITE_ALEO_PROGRAM_ID || 'mastermind.aleo'
const base = `${endpoint}/testnet/program/${encodeURIComponent(programId)}`

export const turns = 10
export const gamePollInterval = 5000
export const pageSize = 8n
export const palette = ['Coral', 'Amber', 'Mint', 'Blue', 'Violet', 'Pink'] as const

export function shortAddress(address: string) {
  return address.slice(0, 9) + '…' + address.slice(-6)
}

export function isGameId(id: string) {
  return /^(0|[1-9]\d{0,19})$/.test(id) && BigInt(id) <= 18446744073709551615n
}

async function mapping(name: string, key: string, signal: AbortSignal): Promise<string | null> {
  const response = await fetch(`${base}/mapping/${name}/${encodeURIComponent(key)}`, { signal })
  if (!response.ok) throw new Error(`Mapping request failed (HTTP ${response.status}).`)
  const value: unknown = await response.json()
  if (value !== null && typeof value !== 'string') throw new Error('Unexpected mapping value.')
  return value
}

function uint64(value: string) {
  const match = /^(\d+)u64$/.exec(value)
  if (!match || !isGameId(match[1])) throw new Error('Unexpected u64 value.')
  return BigInt(match[1])
}

export async function nextGameId(signal: AbortSignal) {
  const counter = await mapping('game_counter__', 'false', signal)
  return counter === null ? '0' : uint64(counter).toString()
}

export function byteArray(value: string, length: number, max: number) {
  const match = /^\[\s*(.*?)\s*\]$/s.exec(value)
  const items = match?.[1].split(',').map(item => /^(\d+)u8$/.exec(item.trim()))
  if (!items || items.length !== length || items.some(item => !item || Number(item[1]) > max)) {
    throw new Error('Unexpected peg data.')
  }
  return items.map(item => Number(item![1]))
}

export interface Game {
  id: string
  codemaker: string
  codebreaker: string
  round: number
  completed: boolean
  solution: number[]
}

export function turnLabel(game: Game) {
  const number = game.completed ? game.round : game.round + 1
  return `Turn ${number} of ${turns}`
}

export async function getGame(id: string, signal: AbortSignal): Promise<Game | null> {
  const value = await mapping('games', id + 'u64', signal)
  if (value === null) return null
  const maker = /\bcodemaker:\s*(aleo1[a-z0-9]+)/.exec(value)
  const breaker = /\bcodebreaker:\s*(aleo1[a-z0-9]+)/.exec(value)
  const round = /\bround:\s*(\d+)u8/.exec(value)
  const completed = /\bcompleted:\s*(true|false)/.exec(value)
  const solution = /\bsolution:\s*(\[[^\]]+\])/.exec(value)
  if (!maker || !breaker || !round || !completed || !solution || Number(round[1]) > turns) {
    throw new Error('Unexpected game data. Check the configured program.')
  }
  return { id, codemaker: maker[1], codebreaker: breaker[1], round: Number(round[1]),
    completed: completed[1] === 'true', solution: byteArray(solution[1], 4, 5) }
}

function roundKey(id: string, round: number) {
  return `{game_id:${id}u64,round:${round}u8}`
}

export async function getGuess(id: string, round: number, signal: AbortSignal) {
  const value = await mapping('guesses', roundKey(id, round), signal)
  return value === null ? null : byteArray(value, 4, 5)
}

export function activeCountQuery(player: string) {
  return queryOptions({
    queryKey: ['active', player, 'count'],
    queryFn: ({ signal }) => getActiveCount(player, signal),
    staleTime: gamePollInterval,
    enabled: Boolean(player),
  })
}

async function getActiveCount(player: string, signal: AbortSignal) {
  const raw = await mapping('active_count', player, signal)
  if (raw === null) {
    // The devnode also returns null for a mapping missing from an older deployment.
    const response = await fetch(base + '/mappings', { signal })
    if (!response.ok) throw new Error('Check that the configured program is deployed.')
    const names: unknown = await response.json()
    if (!Array.isArray(names) || !names.includes('active_count')) {
      throw new Error('This deployment needs the updated contract with active-game mappings.')
    }
  }
  return raw === null ? 0n : uint64(raw)
}

export async function getLobby(player: string, offset: bigint, count: bigint, signal: AbortSignal) {
  const remaining = count > offset ? count - offset : 0n
  const length = Number(remaining < pageSize ? remaining : pageSize)
  const entries = await Promise.all(Array.from({ length }, async (_, i) => {
    const key = `{player:${player},slot:${offset + BigInt(i)}u64}`
    const id = await mapping('active_game', key, signal)
    if (!id) return null // The list may shrink between reads.
    const game = await getGame(uint64(id).toString(), signal)
    if (!game || game.completed) return null
    const guess = await mapping('guesses', roundKey(game.id, game.round), signal)
    const nextPlayer = guess === null ? game.codebreaker : game.codemaker
    return { game, yourTurn: nextPlayer === player }
  }))
  return { count, entries: entries.filter(entry => entry !== null) }
}

export type Board = { game: Game; rows: { guess: number[] | null; pegs: number[] | null }[] }

export async function getBoard(id: string, signal: AbortSignal, previous?: Board | null): Promise<Board | null> {
  const game = await getGame(id, signal)
  if (!game) return null
  const length = Math.min(game.round + (game.completed ? 0 : 1), turns)
  const rows = await Promise.all(Array.from({ length }, async (_, round) => {
    // A scored round is final. Only fetch missing rows and the live round again.
    const cached = previous?.game.id === id ? previous.rows[round] : undefined
    if (round < game.round && cached?.guess && cached.pegs) return cached
    const key = roundKey(id, round)
    const [guess, pegs] = await Promise.all([
      getGuess(id, round, signal),
      round < game.round ? mapping('pegs', key, signal) : null,
    ])
    return {
      guess,
      pegs: pegs === null ? null : byteArray(pegs, 2, 4),
    }
  }))
  return { game, rows }
}
