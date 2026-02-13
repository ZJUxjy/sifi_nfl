import React from 'react';
import { useGameStore, Page } from './store/gameStore';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import RosterPage from './pages/RosterPage';
import SchedulePage from './pages/SchedulePage';
import StandingsPage from './pages/StandingsPage';
import PlayPage from './pages/PlayPage';
import FinancesPage from './pages/FinancesPage';
import TradePage from './pages/TradePage';
import FreeAgencyPage from './pages/FreeAgencyPage';
import DraftPage from './pages/DraftPage';
import StatsPage from './pages/StatsPage';
import ImperialCupPage from './pages/ImperialCupPage';
import TeamSelectModal from './components/TeamSelectModal';
import LoadingScreen from './components/LoadingScreen';

const pageComponents: Record<Page, React.FC> = {
  home: HomePage,
  roster: RosterPage,
  schedule: SchedulePage,
  standings: StandingsPage,
  play: PlayPage,
  finances: FinancesPage,
  trade: TradePage,
  'free-agency': FreeAgencyPage,
  draft: DraftPage,
  stats: StatsPage,
  'imperial-cup': ImperialCupPage
};

const App: React.FC = () => {
  const { initialized, loading, currentPage, userTeam } = useGameStore();
  const PageComponent = pageComponents[currentPage];

  if (loading) {
    return <LoadingScreen />;
  }

  if (!initialized) {
    return <TeamSelectModal />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {userTeam && (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem 1rem',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {userTeam.name}
              </span>
              <span style={{ marginLeft: '1rem', color: 'var(--success)' }}>
                {userTeam.won}W - {userTeam.lost}L
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Season {useGameStore.getState().season} · Week {useGameStore.getState().week}
            </div>
          </div>
        )}
        <PageComponent />
      </main>
    </div>
  );
};

export default App;
