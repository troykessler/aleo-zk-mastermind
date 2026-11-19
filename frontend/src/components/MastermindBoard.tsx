import { useState, type ReactNode } from 'react'
import { palette, turns } from '../aleo/games'
import { Peg } from './Pegs'

type Round = { guess: number[] | null; pegs: number[] | null }
type Selection = { index: number; select: (index: number) => void; locked: boolean }

export function usePegSelection() {
  const [code, setCode] = useState<number[]>([-1, -1, -1, -1])
  const [selected, select] = useState(0)

  function pick(color: number) {
    const next = [...code]
    next[selected] = color
    setCode(next)
    for (let step = 1; step < next.length; step++) {
      const index = (selected + step) % next.length
      if (next[index] < 0) {
        select(index)
        break
      }
    }
  }

  return { code, selected, select, pick, ready: !code.includes(-1) }
}

export function PegSlots({ code, selection }: { code: number[]; selection?: Selection }) {
  return <div className="secret-slots">{code.map((color, index) => {
    const peg = <Peg color={color < 0 ? undefined : color} />
    return selection ? <button type="button" key={index} disabled={selection.locked}
      aria-pressed={selection.index === index}
      aria-label={'Position ' + (index + 1) + ', ' + (palette[color] ?? 'empty')}
      onClick={() => selection.select(index)}>{peg}</button> : <span key={index}>{peg}</span>
  })}</div>
}

export function ColorPalette({ onPick, disabled }: { onPick: (color: number) => void; disabled: boolean }) {
  return <div className="palette" role="group" aria-label="Choose a color">
    {palette.map((name, color) => <button type="button" key={name} disabled={disabled}
      onClick={() => onPick(color)} aria-label={name} title={name}><Peg color={color} /></button>)}
  </div>
}

export function Feedback({ pegs, guessed }: { pegs?: number[] | null; guessed: boolean }) {
  const exact = pegs?.[1] ?? 0
  const total = exact + (pegs?.[0] ?? 0)
  const label = pegs ? (total ? exact + ' exact, ' + pegs[0] + ' color only' : 'No matches')
    : guessed ? 'Awaiting feedback' : 'No feedback yet'
  return <span className="feedback" role="img" aria-label={label} title={label}>
    {Array.from({ length: 4 }, (_, i) => <i key={i} className={i < exact ? 'exact' : i < total ? 'partial' : ''} />)}
    {pegs && !total && <small aria-hidden="true">×</small>}
  </span>
}

export default function MastermindBoard({ code, selection, privateView, rows = [], activeRound, paletteControl, transactionLog, children }: {
  code?: number[]; selection?: Selection; privateView?: ReactNode; rows?: Round[]; activeRound?: number; paletteControl?: ReactNode; transactionLog: ReactNode; children: ReactNode
}) {
  return <div className="play-layout">
    <div className="board-case">
      <section className="secret-tray" aria-label="Secret code">
        <div className="tray-label">Secret code</div>
        {privateView ?? (code ? <PegSlots code={code} selection={selection} /> : <div className="code-cover"><span>Hidden until the game ends</span></div>)}
        {paletteControl}
      </section>
      <section className="guess-tray" aria-label="Guess board">
        <div className="track-labels tray-label"><span>Guesses</span><span>Feedback</span></div>
        <ol reversed className="guess-track">{Array.from({ length: turns }, (_, offset) => {
          const round = turns - 1 - offset
          const row = rows[round]
          return <li key={round} aria-label={'Round ' + (round + 1)} aria-current={round === activeRound ? 'step' : undefined}>
            <div className="guess-slots">{Array.from({ length: 4 }, (_, i) =>
              <Peg key={i} color={row?.guess?.[i]} />)}</div>
            <Feedback pegs={row?.pegs} guessed={Boolean(row?.guess)} />
          </li>
        })}</ol>
        <div className="feedback-legend"><span><i className="exact" />Exact match</span><span><i className="partial" />Color only</span></div>
      </section>
    </div>
    <aside className="play-controls">
      {children}
      {transactionLog}
    </aside>
  </div>
}
