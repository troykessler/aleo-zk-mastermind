import { palette } from '../aleo/games'

export function Peg({ color }: { color?: number }) {
  const label = color === undefined ? 'Empty' : palette[color]
  return <span className={`peg ${color === undefined ? 'empty' : 'c' + color}`}
    aria-label={label} title={label} role="img" />
}
