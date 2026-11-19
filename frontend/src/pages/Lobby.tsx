import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { activeCountQuery, gamePollInterval, getLobby, isGameId, pageSize, turnLabel } from '../aleo/games'
import ActionButton, { RefreshButton } from '../components/ActionButton'
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

function ActiveGames({ address, connect, busy }: { address: string; connect: () => void; busy: boolean }) {
  const [offset, setOffset] = useState(0n)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['active', address, offset.toString()],
    queryFn: async ({ signal }) => getLobby(address, offset, await client.fetchQuery(activeCountQuery(address)), signal),
    enabled: Boolean(address),
    refetchInterval: gamePollInterval,
    refetchIntervalInBackground: true,
  })
  const games = query.data
  const next = games?.entries.find(entry => entry.yourTurn)
  const allWaiting = games && games.count > 0n && BigInt(games.entries.length) === games.count
  const singleWaiting = allWaiting && games.entries.length === 1 ? games.entries[0] : undefined
  const tabGame = next ?? singleWaiting
  const tabStatus = next ? 'Your turn' : allWaiting ? 'Waiting for opponent' : undefined
  useTabTitle(tabGame ? tabStatus + ' · Game #' + tabGame.game.id + ' · ' + turnLabel(tabGame.game) : tabStatus)
  return <section className="panel">
    <div className="section-heading"><h2>My active games</h2>
      {address && <RefreshButton refresh={() => client.invalidateQueries({ queryKey: ['active', address] })}>Refresh</RefreshButton>}
    </div>
    {!address ? <div className="empty-state">
      <p>Connect Shield to find games for your address.</p>
      <ActionButton className="secondary" onClick={connect} busy={busy}>{busy ? 'Connecting…' : 'Connect Shield'}</ActionButton>
    </div> : <>
      {query.isPending && <p role="status">Looking up your games…</p>}
      {query.isError && <p role="alert" className="error">Couldn’t load games. {query.error.message}</p>}
      {games && <>
        {games.entries.length === 0 && <p>{games.count === 0n ? 'No active games yet.' : 'No active games on this page.'}</p>}
        <ul className="games">{games.entries.map(({ game, yourTurn }) =>
          <li key={game.id}><Link to={'/game/' + game.id}>
            <strong>Game #{game.id}</strong>
            <span>{yourTurn ? 'Your turn' : 'Opponent’s turn'} · {turnLabel(game)}</span>
          </Link></li>)}</ul>
        <div className="pagination">
          {offset > 0n && <button className="secondary" onClick={() => setOffset(offset - pageSize)}>Previous</button>}
          {offset + pageSize < games.count && <button className="secondary" onClick={() => setOffset(offset + pageSize)}>Next</button>}
        </div>
      </>}
    </>}
  </section>
}

export default function Lobby(props: { address: string; connect: () => void; busy: boolean }) {
  return <>
    <div className="columns"><ActiveGames key={props.address} {...props} /><OpenGame /></div>
  </>
}
