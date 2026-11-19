import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { activeCountQuery, endpoint, gamePollInterval, programId, shortAddress, testnetEndpoint } from './aleo/games'
import { useShield } from './aleo/useShield'
import { useGameTransactions } from './aleo/useGameTransactions'
import ExplorerLink from './components/ExplorerLink'
import GameRules from './pages/GameRules'
import WhyZk from './pages/WhyZk'
import ActionButton from './components/ActionButton'
import PageTitle from './components/PageTitle'
import TransactionLog from './components/TransactionLog'
import GamePage from './pages/GamePage'
import GameArchive from './pages/GameArchive'
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
  const activity = <TransactionLog entries={transactions.entries} stopTracking={transactions.stopTracking} />
  return <div className="shell">
    <header><Link to="/" className="brand"><span className="mark" aria-hidden="true"><i/><i/><i/><i/></span>Aleo Mastermind</Link>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>Play</NavLink>
        {wallet.address && <NavLink to="/games" className="my-games-link">
          My games
          {count !== undefined && count > 0n && <span className="active-count" title={count === 1n ? '1 active game' : count + ' active games'}>
            {count.toString()}
          </span>}
        </NavLink>}
        <NavLink to="/archive">Archive</NavLink>
        <NavLink to="/rules">Rules</NavLink>
        <NavLink to="/why-zk">Why ZK?</NavLink>
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
      <Route path="/games" element={wallet.address
        ? <><PageTitle>My games</PageTitle><Lobby address={wallet.address} /></>
        : <section><PageTitle>Connect your wallet</PageTitle>
          <p>Connect Shield to view your games, or browse the <Link to="/archive">public game archive</Link>.</p>
        </section>} />
      <Route path="/archive" element={<GameArchive />} />
      <Route path="/rules" element={<GameRules />} />
      <Route path="/why-zk" element={<WhyZk />} />
      <Route path="/game/:id" element={<GamePage address={wallet.address} transactions={transactions} />} />
      <Route path="*" element={<section><PageTitle>Page not found</PageTitle><Link to="/">Return to board</Link></section>} />
    </Routes></main>
    <footer>
      <span className="network">{endpoint === testnetEndpoint ? 'Testnet' : 'Custom Aleo node'}</span>
      <ExplorerLink type="program" id={programId}>{programId}</ExplorerLink>
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
