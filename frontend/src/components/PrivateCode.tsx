import { useState } from 'react'
import { isShieldLocked, readPrivateCode } from '../aleo/useShield'
import ActionButton from './ActionButton'
import { PegSlots } from './MastermindBoard'

export default function PrivateCode({ maker, id }: { maker: string; id: string }) {
  const [code, setCode] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reveal() {
    setError('')
    setBusy(true)
    try {
      setCode(await readPrivateCode(maker, id))
    } catch (cause) {
      if (!isShieldLocked(cause)) setError(cause instanceof Error ? cause.message : 'Couldn’t read your private code.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="private-code">
    <div className="private-code-label"><span className="lock-icon" aria-hidden="true" />Encrypted on Aleo</div>
    <div className={code ? 'private-reveal' : 'sealed-slots'} aria-hidden={code ? undefined : true}>
      <PegSlots code={code ?? [-1, -1, -1, -1]} />
    </div>
    <div className="private-code-controls">
      <span>Codemaker’s private record</span>
      <ActionButton className="text-button" busy={busy} aria-expanded={Boolean(code)}
        onClick={code ? () => setCode(null) : reveal}>
        {code ? 'Hide code' : busy ? 'Opening…' : 'Reveal with Shield'}
      </ActionButton>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </div>
}
