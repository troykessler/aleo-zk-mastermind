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
      <div className="header-actions">
        <a className="github-link" href="https://github.com/troykessler/aleo-zk-mastermind"
          target="_blank" rel="noopener noreferrer" title="View source on GitHub"
          aria-label="View source on GitHub (opens in a new tab)">
          <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </a>
        <ActionButton className="wallet" onClick={wallet.toggle} busy={wallet.busy}
          title={wallet.address ? `Disconnect Shield (${wallet.address})` : undefined}
          aria-label={wallet.address && !wallet.busy ? `Disconnect Shield wallet ${shortAddress(wallet.address)}` : undefined}>
          {wallet.busy ? (wallet.address ? 'Disconnecting…' : 'Connecting…') : wallet.address ? <>
            <span className="wallet-address">{shortAddress(wallet.address)}</span>
            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11" />
            </svg>
          </> : 'Connect Shield'}
        </ActionButton>
      </div>
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
