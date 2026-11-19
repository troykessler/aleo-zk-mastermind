import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { activeCountQuery, endpoint, gamePollInterval, programId, shortAddress, testnetEndpoint } from './aleo/games'
import { useShield } from './aleo/useShield'
import { useGameTransactions } from './aleo/useGameTransactions'
import ExternalLinkIcon from './components/ExternalLinkIcon'
import GameRules from './pages/GameRules'
import ActionButton from './components/ActionButton'
import TransactionLog from './components/TransactionLog'
import GamePage from './pages/GamePage'
import Lobby from './pages/Lobby'
import CreateGame from './pages/CreateGame'
import './style.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5000 } } })

function GameApp({ wallet }: { wallet: ReturnType<typeof useShield> }) {
  const transactions = useGameTransactions(wallet.address)
  const { data: count } = useQuery({
    ...activeCountQuery(wallet.address),
    refetchInterval: gamePollInterval,
    refetchIntervalInBackground: true,
  })
  const activity = <TransactionLog entries={transactions.entries} />
  return <div className="shell">
    <header><Link to="/" className="brand"><span className="mark" aria-hidden="true"><i/><i/><i/><i/></span>Aleo Mastermind</Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>Play</NavLink>
        <NavLink to="/games" className="my-games-link">
          My games
          {count !== undefined && <span className="active-count" title={count === 1n ? '1 active game' : count + ' active games'}>
            {count.toString()}
          </span>}
        </NavLink>
        <NavLink to="/rules">Rules</NavLink>
      </nav>
      <ActionButton className="wallet" onClick={wallet.toggle} busy={wallet.busy} title={wallet.address || undefined}>
        {wallet.address ? <>
          <span className="wallet-address">{shortAddress(wallet.address)}</span>
          <span className="wallet-action">{wallet.busy ? 'Disconnecting…' : 'Disconnect Shield'}</span>
        </> : wallet.busy ? 'Connecting…' : 'Connect Shield'}
      </ActionButton>
    </header>
    {wallet.error && <p className="error wallet-error" role="alert">{wallet.error}</p>}
    <main><Routes>
      <Route path="/" element={
        <CreateGame address={wallet.address} connect={wallet.toggle} busy={wallet.busy} transactions={transactions}>
          {activity}
        </CreateGame>
      } />
      <Route path="/new" element={<Navigate to="/" replace />} />
      <Route path="/games" element={<><h1>My games</h1><Lobby address={wallet.address} connect={wallet.toggle} busy={wallet.busy} /></>} />
      <Route path="/rules" element={<GameRules />} />
      <Route path="/game/:id" element={<GamePage address={wallet.address} transactions={transactions} />} />
      <Route path="*" element={<section><h1>Page not found</h1><Link to="/">Return to board</Link></section>} />
    </Routes></main>
    <footer><span className="network">{endpoint === testnetEndpoint ? 'Aleo Testnet' : 'Custom Aleo node'}</span>
      <a className="explorer-link" href={'https://testnet.explorer.provable.com/program/' + encodeURIComponent(programId)}
        target="_blank" rel="noopener noreferrer" aria-label={programId + ' on the public testnet explorer (opens in a new tab)'}>
        {programId}
        <ExternalLinkIcon />
      </a>
      <span className="node-endpoint">{endpoint}</span>
    </footer>
  </div>
}

function App() {
  const wallet = useShield()
  return <GameApp key={wallet.session} wallet={wallet} />
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={client}><BrowserRouter><App /></BrowserRouter></QueryClientProvider>
)
