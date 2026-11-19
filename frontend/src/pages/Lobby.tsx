import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { activeCountQuery, gamePollInterval, getLobby, isGameId, pageSize, turnLabel } from '../aleo/games'
import { RefreshButton } from '../components/ActionButton'
import { useTabTitle } from '../useTabTitle'

function OpenGame() {
  const [id, setId] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  function open(event: FormEvent) {
    event.preventDefault()
    if (!isGameId(id.trim())) {
      setError('Enter a valid unsigned 64-bit game ID.')
      return
    }
    navigate('/game/' + id.trim())
  }

  return <aside className="panel open-game">
    <h2>Open a game</h2>
    <p>Have a game ID? Go straight to the board.</p>
    <form onSubmit={open}>
      <label htmlFor="game-id">Game ID</label>
      <div className="input-group"><input id="game-id" placeholder="e.g. 42" inputMode="numeric"
        value={id} onChange={e => { setId(e.target.value); setError('') }} required />
        <button>Open</button></div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  </aside>
}

function ActiveGames({ address }: { address: string }) {
  const [requestedOffset, setOffset] = useState(0n)
  const client = useQueryClient()
  const countQuery = useQuery(activeCountQuery(address))
  const count = countQuery.data ?? 0n
  const lastOffset = count > 0n ? ((count - 1n) / pageSize) * pageSize : 0n
  const offset = requestedOffset > lastOffset ? lastOffset : requestedOffset
  useEffect(() => {
    if (offset !== requestedOffset) setOffset(offset)
  }, [offset, requestedOffset])
  const query = useQuery({
    queryKey: ['active', address, 'games', offset.toString(), count.toString()],
    queryFn: ({ signal }) => getLobby(address, offset, count, signal),
    enabled: count > 0n,
    refetchInterval: gamePollInterval,
    refetchIntervalInBackground: true,
  })
  const games = query.data ?? []
  const error = countQuery.error ?? query.error
  const next = games.find(entry => entry.yourTurn)
  const allWaiting = !next && count > 0n && BigInt(games.length) === count
  const singleWaiting = allWaiting && games.length === 1 ? games[0] : undefined
  const tabGame = next ?? singleWaiting
  const tabStatus = next ? 'Your turn' : allWaiting ? 'Waiting for opponent' : undefined
  useTabTitle(tabGame ? tabStatus + ' · Game #' + tabGame.game.id + ' · ' + turnLabel(tabGame.game) : tabStatus)
  return <section className="panel">
    <div className="section-heading"><h2>My active games</h2>
      <RefreshButton refresh={() => client.invalidateQueries({ queryKey: ['active', address] })}>Refresh</RefreshButton>
    </div>
    {(countQuery.isPending || (count > 0n && query.isPending)) && <p role="status">Looking up your games…</p>}
    {error && <p role="alert" className="error">Couldn’t load games. {error.message}</p>}
    {countQuery.data === 0n && <p>No active games yet.</p>}
    {query.data && <>
      {games.length === 0 && <p>No active games on this page.</p>}
      <ul className="games">{games.map(({ game, yourTurn }) =>
        <li key={game.id}><Link to={'/game/' + game.id}>
          <strong>Game #{game.id}</strong>
          <span>{yourTurn ? 'Your turn' : 'Opponent’s turn'} · {turnLabel(game)}</span>
        </Link></li>)}</ul>
      <div className="pagination">
        {offset > 0n && <button className="secondary" onClick={() => setOffset(offset - pageSize)}>Previous</button>}
        {offset < lastOffset && <button className="secondary" onClick={() => setOffset(offset + pageSize)}>Next</button>}
      </div>
    </>}
  </section>
}

export default function Lobby({ address }: { address: string }) {
  return <div className="columns"><ActiveGames key={address} address={address} /><OpenGame /></div>
}
