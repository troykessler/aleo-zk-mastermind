import { endpoint, isGameId, palette, programId, turns } from './games'

// Only save the wallet receipt and public move data. A create receipt never contains the secret.
export type PendingTransaction = { id: string; transactionId: string } & (
  | { kind: 'create'; breaker: string }
  | { kind: 'guess'; round: number; colors: number[] }
  | { kind: 'feedback'; round: number }
)

function storageKey(address: string) {
  return `aleo-mastermind:pending:${endpoint}:${programId}:${address}`
}

export function readPending(address: string): PendingTransaction | null {
  if (!address) return null
  try {
    const raw = sessionStorage.getItem(storageKey(address))
    if (!raw) return null
    const move = JSON.parse(raw)
    if (!move || typeof move.id !== 'string' || !isGameId(move.id) ||
        typeof move.transactionId !== 'string' || !move.transactionId) return null
    if (move.kind === 'create') return typeof move.breaker === 'string' ? move : null
    if (!Number.isInteger(move.round) || move.round < 0 || move.round >= turns) return null
    if (move.kind === 'feedback') return move
    if (move.kind === 'guess' && Array.isArray(move.colors) && move.colors.length === 4 &&
        move.colors.every((color: number) => Number.isInteger(color) && color >= 0 && color < palette.length)) return move
  } catch {
    // Ignore malformed receipts and unavailable browser storage.
  }
  return null
}

export function savePending(address: string, receipt: PendingTransaction | null) {
  try {
    if (receipt) sessionStorage.setItem(storageKey(address), JSON.stringify(receipt))
    else sessionStorage.removeItem(storageKey(address))
  } catch {
    // In-memory tracking still works when storage is unavailable.
  }
}
