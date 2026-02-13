import React from 'react';
import { useGameStore } from '../store/gameStore';

const HomePage: React.FC = () => {
  const { userTeam, season, week, teams, players, setPage } = useGameStore();

  const features = [
    { icon: '🏈', title: 'Manage Your Roster', desc: 'Build your dream team with 40+ players across all positions' },
    { icon: '📅', title: 'Season Schedule', desc: 'Navigate through 17 weeks of regular season action' },
    { icon: '🏆', title: 'Chase Glory', desc: 'Compete for division titles and the Imperial Cup' },
    { icon: '💰', title: 'Financial Control', desc: 'Manage contracts, salary cap, and team finances' },
    { icon: '🔄', title: 'Trade System', desc: 'Make deals with AI teams to improve your roster' },
    { icon: '🎯', title: 'Draft Prospects', desc: 'Build for the future through the annual draft' }
  ];

  return (
    <div>
      <div className="home-hero">
        <h1>🏈 SIFI NFL</h1>
        <p>Sci-Fi American Football Manager - Lead your team to glory in a futuristic universe!</p>
        
        <div className="stat-grid" style={{ maxWidth: '600px', margin: '0 auto 2rem' }}>
          <div className="stat-box">
            <div className="stat-value">{teams.length}</div>
            <div className="stat-label">Teams</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{players.length}</div>
            <div className="stat-label">Players</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">4</div>
            <div className="stat-label">Regions</div>
          </div>
        </div>

        {userTeam && (
          <div className="home-actions">
            <button className="btn btn-primary btn-lg" onClick={() => setPage('play')}>
              ▶️ Play Week {week}
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => setPage('roster')}>
              🏈 View Roster
            </button>
          </div>
        )}
      </div>

      <h3 style={{ marginBottom: '1.5rem' }}>Game Features</h3>
      <div className="feature-grid">
        {features.map((feature, i) => (
          <div key={i} className="feature-card">
            <div className="feature-icon">{feature.icon}</div>
            <div className="feature-title">{feature.title}</div>
            <div className="feature-desc">{feature.desc}</div>
          </div>
        ))}
      </div>

      {userTeam && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <div className="card-header">
            <h3 className="card-title">📊 Your Team Overview</h3>
          </div>
          <div className="stat-grid">
            <div className="stat-box">
              <div className="stat-value">{userTeam.won}-{userTeam.lost}</div>
              <div className="stat-label">Record</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">${userTeam.budget}M</div>
              <div className="stat-label">Budget</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">${userTeam.cash}M</div>
              <div className="stat-label">Cash</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{userTeam.market?.toUpperCase()}</div>
              <div className="stat-label">Market</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
