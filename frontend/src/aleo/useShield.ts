import { useCallback, useEffect, useRef, useState } from 'react'
import { Network, type RecordEnvelope } from '@provablehq/aleo-types'
import { WalletDecryptPermission, WalletReadyState } from '@provablehq/aleo-wallet-standard'
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adapter-shield'
import { byteArray, endpoint, getGame, getGuess, nextGameId, programId, testnetEndpoint } from './games'

const adapter = new ShieldWalletAdapter({ remote: false })
const sessionEvents = new EventTarget()

export function isShieldLocked(cause: unknown) {
  const message = cause instanceof Error ? cause.name + ' ' + cause.message : String(cause)
  return /\bNotUnlocked\b|\bUnlock Shield\b/i.test(message)
}

async function walletRequest<T>(request: Promise<T>): Promise<T> {
  const account = adapter.account
  try {
    return await request
  } catch (cause) {
    if (account && account === adapter.account && isShieldLocked(cause)) {
      sessionEvents.dispatchEvent(new Event('lock'))
    }
    throw cause
  }
}

function colorInput(colors: number[]) {
  if (colors.length !== 4 || colors.some(c => !Number.isInteger(c) || c < 0 || c > 5)) {
    throw new Error('Choose all four colors.')
  }
  return '[' + colors.map(c => c + 'u8').join(', ') + ']'
}

export async function submitGame(maker: string, breaker: string, colors: number[]) {
  if (endpoint !== testnetEndpoint) throw new Error('Select public testnet to create a game with Shield.')
  if (!/^aleo1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(breaker) || breaker === maker) {
    throw new Error('Enter the other player’s Aleo address.')
  }
  const code = colorInput(colors)
  const id = await nextGameId(AbortSignal.timeout(15000))
  if (adapter.account?.address !== maker || adapter.network !== Network.TESTNET) {
    throw new Error('Reconnect the codemaker account to Shield on testnet.')
  }
  const { transactionId } = await walletRequest(adapter.executeTransaction({
    program: programId, function: 'codemaker_create_game',
    inputs: [breaker, id + 'u64', code],
    privateFee: false,
  }))
  return { id, transactionId, breaker }
}

export async function submitGuess(breaker: string, id: string, round: number, colors: number[]) {
  if (endpoint !== testnetEndpoint) throw new Error('Select public testnet to guess with Shield.')
  const guess = colorInput(colors)
  const signal = AbortSignal.timeout(15000)
  const [game, existingGuess] = await Promise.all([getGame(id, signal), getGuess(id, round, signal)])
  if (!game || game.completed || game.round !== round || existingGuess) {
    throw new Error('This turn has changed. Refresh the board before guessing.')
  }
  if (game.codebreaker !== breaker || adapter.account?.address !== breaker || adapter.network !== Network.TESTNET) {
    throw new Error('Connect the codebreaker’s testnet account in Shield.')
  }
  return walletRequest(adapter.executeTransaction({
    program: programId, function: 'codebreaker_guess', inputs: [id + 'u64', guess], privateFee: false,
  }))
}

export async function submitFeedback(maker: string, id: string, round: number) {
  if (endpoint !== testnetEndpoint) throw new Error('Select public testnet to give feedback with Shield.')
  const signal = AbortSignal.timeout(15000)
  const [game, guess] = await Promise.all([getGame(id, signal), getGuess(id, round, signal)])
  if (!game || game.completed || game.round !== round || !guess) {
    throw new Error('This turn has changed. Refresh the board before giving feedback.')
  }
  if (game.codemaker !== maker || adapter.account?.address !== maker || adapter.network !== Network.TESTNET) {
    throw new Error('Connect the codemaker’s testnet account in Shield.')
  }
  const gameId = id + 'u64'
  const state = `{ codemaker: ${game.codemaker}, codebreaker: ${game.codebreaker}, round: ${round}u8, completed: ${game.completed}, solution: ${colorInput(game.solution)} }`
  return walletRequest(adapter.executeTransaction({
    program: programId, function: 'codemaker_feedback', privateFee: false,
    inputs: [gameId, state, colorInput(guess), {
      type: 'record', program: programId, recordname: 'Solution', filters: { game_id: { eq: gameId } },
    }],
  }))
}

export function transactionStatus(transactionId: string) {
  return walletRequest(adapter.transactionStatus(transactionId))
}

export async function readPrivateCode(maker: string, id: string) {
  const isMaker = () => adapter.account?.address === maker && adapter.network === Network.TESTNET && endpoint === testnetEndpoint
  if (!isMaker()) throw new Error('Connect the codemaker account on testnet.')
  let records: unknown[]
  try {
    records = await walletRequest(adapter.requestRecords(programId, true, 'unspent'))
  } catch (cause) {
    if (isShieldLocked(cause)) throw cause
    throw new Error('Shield couldn’t open the record. Approve the read request or reconnect Shield and try again.')
  }
  if (!isMaker()) throw new Error('The connected account changed.')
  for (const record of records) {
    if (!record || typeof record !== 'object') continue
    const { programName, recordName, recordView, recordPlaintext, plaintext } = record as RecordEnvelope
    if ((programName && programName !== programId) || (recordName && recordName !== 'Solution')) continue
    let gameId = recordView?.fields?.game_id
    let code = recordView?.fields?.code
    if (!recordView) {
      // Older Shield versions return an Aleo record literal.
      const literal = recordPlaintext ?? plaintext
      if (typeof literal !== 'string' || /\bowner:\s*(aleo1[a-z0-9]+)/.exec(literal)?.[1] !== maker) continue
      gameId = /\bgame_id:\s*(\d+u64)\b/.exec(literal)?.[1]
      code = /\bcode:\s*(\[[^\]]+\])/.exec(literal)?.[1]
    }
    if (gameId?.replace(/\.private$/, '') === id + 'u64' && typeof code === 'string') {
      return byteArray(code.replace(/\.private\b/g, ''), 4, 5)
    }
  }
  throw new Error('Shield hasn’t returned this game’s solution. Check wallet sync and record permissions, then try again.')
}

const reconnectKey = 'aleo-mastermind:shield:testnet'

function rememberWallet(remember: boolean) {
  try {
    if (remember) localStorage.setItem(reconnectKey, '1')
    else localStorage.removeItem(reconnectKey)
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}

export function useShield() {
  const [identity, setIdentity] = useState({ address: '', session: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const wantsConnection = useRef(false)
  const connecting = useRef(false)
  const revision = useRef(0)

  const selectAddress = useCallback((address: string) => {
    setIdentity(previous => previous.address === address ? previous : {
      address, session: previous.session + (previous.address ? 1 : 0),
    })
  }, [])

  const clearSession = useCallback(() => {
    revision.current++
    wantsConnection.current = false
    selectAddress('')
    setError('')
  }, [selectAddress])

  const connect = useCallback(async () => {
    if (connecting.current || !wantsConnection.current) return
    connecting.current = true
    setBusy(true)
    setError('')
    try {
      // Serialize authorization if the user changes accounts again while Shield is open.
      while (wantsConnection.current) {
        const started = revision.current
        try {
          const account = await adapter.connect(Network.TESTNET, WalletDecryptPermission.UponRequest, [programId], {
            recordAccess: { level: 'byProgram', programs: [{
              program: programId, records: [{ recordname: 'Solution', fields: [{ name: 'game_id' }, { name: 'code' }] }],
            }] },
          })
          if (started !== revision.current) continue
          selectAddress(account.address)
          rememberWallet(true)
        } catch (cause) {
          if (started !== revision.current) continue
          if (isShieldLocked(cause)) {
            clearSession()
          } else {
            wantsConnection.current = false
            rememberWallet(false)
            setError(cause instanceof Error ? cause.message : 'Shield connection failed.')
          }
        }
        break
      }
    } finally {
      connecting.current = false
      setBusy(false)
    }
  }, [clearSession, selectAddress])

  useEffect(() => {
    try { wantsConnection.current = localStorage.getItem(reconnectKey) === '1' } catch { /* Storage is optional. */ }

    const restore = (state: WalletReadyState) => {
      if (state === WalletReadyState.INSTALLED && !adapter.account) void connect()
    }
    const accountChanged = () => {
      if (!wantsConnection.current) return
      revision.current++
      selectAddress('')
      // Shield's event carries no address. Ask it to authorize the selected account.
      queueMicrotask(() => void connect())
    }
    const disconnected = () => {
      clearSession()
      rememberWallet(false)
    }
    const networkChanged = (network: Network) => {
      if (network === Network.TESTNET || !wantsConnection.current) return
      disconnected()
      setError('Switch Shield to testnet and reconnect to play.')
    }
    adapter.on('readyStateChange', restore)
    adapter.on('accountChange', accountChanged)
    adapter.on('networkChange', networkChanged)
    adapter.on('disconnect', disconnected)
    sessionEvents.addEventListener('lock', clearSession)
    if (wantsConnection.current && adapter.account) selectAddress(adapter.account.address)
    else restore(adapter.readyState)
    return () => {
      adapter.off('readyStateChange', restore)
      adapter.off('accountChange', accountChanged)
      adapter.off('networkChange', networkChanged)
      adapter.off('disconnect', disconnected)
      sessionEvents.removeEventListener('lock', clearSession)
      wantsConnection.current = false
      revision.current++
    }
  }, [clearSession, connect, selectAddress])

  async function toggle() {
    if (busy) return
    if (!identity.address) {
      wantsConnection.current = true
      await connect()
      return
    }
    wantsConnection.current = false
    revision.current++
    rememberWallet(false)
    setBusy(true)
    setError('')
    try {
      await adapter.disconnect()
    } catch (cause) {
      if (!isShieldLocked(cause)) setError(cause instanceof Error ? cause.message : 'Shield disconnect failed.')
    } finally {
      selectAddress('')
      setBusy(false)
    }
  }
  return { ...identity, busy, error, toggle }
}
