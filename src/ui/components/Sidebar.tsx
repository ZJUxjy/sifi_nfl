import React from 'react';
import { useGameStore, Page } from '../store/gameStore';

interface NavItem {
  page: Page;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { page: 'home', icon: '🏠', label: 'Home' },
  { page: 'roster', icon: '🏈', label: 'Roster' },
  { page: 'schedule', icon: '📅', label: 'Schedule' },
  { page: 'standings', icon: '🏆', label: 'Standings' },
  { page: 'play', icon: '▶️', label: 'Play Week' },
  { page: 'finances', icon: '💰', label: 'Finances' },
  { page: 'trade', icon: '🔄', label: 'Trade' },
  { page: 'free-agency', icon: '📋', label: 'Free Agency' },
  { page: 'draft', icon: '🎯', label: 'Draft' },
  { page: 'stats', icon: '📈', label: 'Stats' },
  { page: 'imperial-cup', icon: '👑', label: 'Imperial Cup' }
];

const Sidebar: React.FC = () => {
  const { currentPage, setPage, userTeam, season, week } = useGameStore();

  const handleSaveGame = async () => {
    const saveData = await useGameStore.getState().saveGame();
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sifi-nfl-save-${season}-week${week}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🏈 SIFI NFL</h1>
        <div className="version">Sci-Fi Football Manager</div>
      </div>

      <ul className="nav-menu">
        {navItems.map(item => (
          <li key={item.page} className="nav-item">
            <div
              className={`nav-link ${currentPage === item.page ? 'active' : ''}`}
              onClick={() => setPage(item.page)}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
        <div className="nav-link" onClick={handleSaveGame}>
          <span className="icon">💾</span>
          <span>Save Game</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
