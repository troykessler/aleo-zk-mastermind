import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endpoint, programId, testnetEndpoint, type Board } from '../aleo/games'
import { getGameHistory, historyRows } from '../aleo/history'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function GameHistory({ board }: { board: Board }) {
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['game-history', endpoint, programId, board.game.id],
    enabled: open && endpoint === testnetEndpoint,
    queryFn: ({ signal, client, queryKey }) => getGameHistory(client, board, signal, client.getQueryData(queryKey)),
    staleTime: Infinity,
    refetchInterval: query => historyRows(board, query.state.data).some(row => !row.stamp) ? 15000 : false,
  })
  const rows = historyRows(board, query.data)
  return <details className="game-history" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Game history</summary>
    <ol>{rows.reverse().map(({ key, text, stamp }) => <li key={key}>
      <span>{text}</span>
      {stamp && <a href={'https://testnet.explorer.provable.com/transaction/' + stamp.tx}
        target="_blank" rel="noopener noreferrer" aria-label={'View transaction for ' + text}>
        <time dateTime={new Date(stamp.time).toISOString()}>{dateFormat.format(stamp.time)}</time> ↗
      </a>}
    </li>)}</ol>
    {rows.some(row => !row.stamp) && <p className="history-note">{endpoint !== testnetEndpoint
      ? 'Block times are available on public testnet.' : query.isError ? 'Explorer times are temporarily unavailable.'
      : 'Block times appear as the explorer indexes each move.'}</p>}
  </details>
}
