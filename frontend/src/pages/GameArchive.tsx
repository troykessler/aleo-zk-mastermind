import { queryOptions, useQueries, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { gamePollInterval, getGame, isGameId, nextGameId, shortAddress, turnLabel } from '../aleo/games'
import { RefreshButton } from '../components/ActionButton'
import PageTitle from '../components/PageTitle'
import { useTabTitle } from '../useTabTitle'

const pageSize = 20n

export default function GameArchive() {
  useTabTitle('Game archive')
  const [params, setParams] = useSearchParams()
  const counter = useQuery({
    queryKey: ['archive', 'count'],
    queryFn: ({ signal }) => nextGameId(signal),
    refetchInterval: gamePollInterval,
  })
  const count = BigInt(counter.data ?? '0')
  // The cursor is an exclusive game ID, so new games don't shift older pages.
  const before = params.get('before')
  const cursor = before && isGameId(before) ? BigInt(before) : count
  const end = count > pageSize && cursor > 0n && cursor < count ? cursor : count
  const start = end > pageSize ? end - pageSize : 0n
  const ids = Array.from({ length: Number(end - start) }, (_, i) => String(end - 1n - BigInt(i)))
  const games = useQueries({
    queries: ids.map(id => queryOptions({
      queryKey: ['archive', 'game', id],
      queryFn: ({ signal }) => getGame(id, signal),
      staleTime: query => query.state.data?.completed ? Infinity : gamePollInterval,
      refetchInterval: query => query.state.data?.completed ? false : gamePollInterval,
    })),
  })

  function goToPage(before: bigint) {
    const next = new URLSearchParams(params)
    if (before >= count) next.delete('before')
    else next.set('before', before.toString())
    setParams(next, { preventScrollReset: true })
  }

  return <section className="game-archive">
    <PageTitle>Game archive</PageTitle>
    <p>Browse all games, newest first. Open a board to see its guesses and feedback.</p>
    {counter.isPending && <p role="status">Loading games…</p>}
    {counter.isError && <p role="alert" className="error">Couldn’t load the game count. <RefreshButton refresh={() => counter.refetch()}>Retry</RefreshButton></p>}
    {counter.data === '0' && <p>No games have been created yet.</p>}
    {ids.length > 0 && <div className="archive-table-scroll" role="region" aria-label="Archived games" tabIndex={0}>
      <table className="archive-table" aria-label="Games, newest first">
        <thead><tr>
          <th scope="col">Game</th><th scope="col">Status</th><th scope="col">Turn</th>
          <th scope="col">Codemaker</th><th scope="col">Codebreaker</th>
        </tr></thead>
        <tbody>{ids.map((id, i) => {
          const game = games[i].data
          return <tr key={id}>
            <th scope="row"><Link to={'/game/' + id} aria-label={'Open game #' + id}>#{id}</Link></th>
            {game ? <>
              <td>{game.completed ? 'Finished' : 'Active'}</td>
              <td>{turnLabel(game)}</td>
              <td title={game.codemaker}>{shortAddress(game.codemaker)}</td>
              <td title={game.codebreaker}>{shortAddress(game.codebreaker)}</td>
            </> : <td colSpan={4}>{games[i].isPending ? 'Loading…' : 'Details unavailable'}</td>}
          </tr>
        })}</tbody>
      </table>
    </div>}
    {count > pageSize && <div className="pagination archive-pagination" role="group" aria-label="Game archive pages">
      <span>{(count - end + 1n).toString()}–{(count - start).toString()} of {count.toString()}</span>
      <button className="secondary" disabled={end === count} onClick={() => goToPage(end + pageSize)}>Newer games</button>
      <button className="secondary" disabled={start === 0n} onClick={() => goToPage(start)}>Older games</button>
    </div>}
  </section>
}
