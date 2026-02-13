import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';

const formatSalary = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
};

const DraftPage: React.FC = () => {
  const { teams, userTid, userTeam } = useGameStore();
  const [currentRound, setCurrentRound] = useState(1);
  const [currentPick, setCurrentPick] = useState(1);

  // Generate mock draft prospects
  const prospects = Array.from({ length: 224 }, (_, i) => {
    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
    const round = Math.floor(i / 32) + 1;
    const pick = (i % 32) + 1;
    
    return {
      pid: 20000 + i,
      name: `Draft Prospect ${i + 1}`,
      pos: positions[i % positions.length],
      age: 21 + Math.floor(Math.random() * 3),
      ovr: 70 - round * 3 + Math.floor(Math.random() * 10),
      pot: 75 - round * 2 + Math.floor(Math.random() * 15),
      college: ['Ohio State', 'Alabama', 'Georgia', 'Michigan', 'Texas A&M', 'USC'][i % 6],
      round,
      pick
    };
  });

  const draftOrder = teams.slice(0, 32).map((team, i) => ({
    pick: i + 1,
    team,
    prospect: null as any
  }));

  const handleDraft = (prospect: any) => {
    alert(`Drafted ${prospect.name}! (Demo mode)`);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🎯 Draft Room</h3>
          <span style={{ color: 'var(--text-muted)' }}>Round {currentRound}, Pick {currentPick}</span>
        </div>

        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-box">
            <div className="stat-value">7</div>
            <div className="stat-label">Rounds</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">224</div>
            <div className="stat-label">Total Picks</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{prospects.length}</div>
            <div className="stat-label">Prospects</div>
          </div>
        </div>

        {/* Round Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(round => (
            <button
              key={round}
              className={`btn btn-sm ${currentRound === round ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentRound(round)}
            >
              Round {round}
            </button>
          ))}
        </div>

        {/* Draft Board */}
        <h4 style={{ marginBottom: '1rem' }}>Available Prospects - Round {currentRound}</h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Overall</th>
                <th>Pos</th>
                <th>Name</th>
                <th>Age</th>
                <th>OVR</th>
                <th>POT</th>
                <th>College</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {prospects
                .filter(p => p.round === currentRound)
                .slice(0, 32)
                .sort((a, b) => b.ovr - a.ovr)
                .map((prospect, i) => (
                  <tr key={prospect.pid}>
                    <td>#{(currentRound - 1) * 32 + i + 1}</td>
                    <td className={`pos-${prospect.pos}`}>{prospect.pos}</td>
                    <td className="highlight">{prospect.name}</td>
                    <td>{prospect.age}</td>
                    <td className={prospect.ovr >= 70 ? 'ovr-elite' : prospect.ovr >= 60 ? 'ovr-good' : 'ovr-average'}>
                      {prospect.ovr}
                    </td>
                    <td>{prospect.pot}</td>
                    <td>{prospect.college}</td>
                    <td>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => handleDraft(prospect)}
                      >
                        Draft
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Your Draft Picks */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Your Draft Picks</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(round => (
            <div 
              key={round}
              style={{
                background: 'var(--bg-hover)',
                padding: '0.5rem 1rem',
                borderRadius: '4px'
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Round {round}:</span>{' '}
              <span className="highlight">Pick {userTid !== null ? (userTid % 32) + 1 : round * 10}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DraftPage;
