import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';

const ImperialCupPage: React.FC = () => {
  const { teams, season } = useGameStore();
  const [selectedYear, setSelectedYear] = useState(season);

  // Check if Imperial Cup happens this year (every 4 years)
  const isCupYear = selectedYear % 4 === 0;

  // Generate tournament bracket
  const generateBracket = () => {
    const qualified = teams.slice(0, 16);
    const rounds = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'];
    
    return {
      rounds,
      teams: qualified.map((t, i) => ({
        seed: i + 1,
        team: t,
        region: ['Origin', 'First', 'Second', 'Mining'][i % 4]
      }))
    };
  };

  const bracket = generateBracket();

  // Historical winners
  const history = [
    { year: 2024, winner: 'Origin Emperors', runnerUp: 'Mining United', score: '28-21' },
    { year: 2020, winner: 'Origin Lions', runnerUp: 'First Titans', score: '31-24' },
    { year: 2016, winner: 'Mining Miners', runnerUp: 'Origin Eagles', score: '17-14' },
    { year: 2012, winner: 'Origin Royals', runnerUp: 'Second Storm', score: '35-28' },
  ];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">👑 Imperial Cup</h3>
          <span style={{ color: 'var(--text-muted)' }}>
            {isCupYear ? `${selectedYear} Tournament` : `Next Cup: ${selectedYear + (4 - selectedYear % 4)}`}
          </span>
        </div>

        {/* Tournament Info */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(0, 212, 255, 0.2))',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <h2 style={{ marginBottom: '0.5rem' }}>🏆 Imperial Cup</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            The most prestigious tournament in football! Every 4 years, top teams from all regions 
            compete for ultimate glory.
          </p>
          <div className="stat-grid" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="stat-box">
              <div className="stat-value">16</div>
              <div className="stat-label">Teams</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">4</div>
              <div className="stat-label">Regions</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">4</div>
              <div className="stat-label">Years</div>
            </div>
          </div>
        </div>

        {isCupYear ? (
          <>
            <h4 style={{ marginBottom: '1rem' }}>Qualified Teams</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
              {bracket.teams.map(t => (
                <div 
                  key={t.seed}
                  style={{
                    background: 'var(--bg-hover)',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span style={{ 
                    background: 'var(--primary)', 
                    color: 'white', 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}>
                    {t.seed}
                  </span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{t.team.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.region}</div>
                  </div>
                </div>
              ))}
            </div>

            <h4 style={{ marginBottom: '1rem' }}>Tournament Bracket</h4>
            <div style={{ 
              background: 'var(--bg-dark)', 
              borderRadius: '8px', 
              padding: '1rem',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <p>🏆 Bracket will be displayed once the tournament begins</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Tournament starts after regular season
              </p>
            </div>
          </>
        ) : (
          <div style={{ 
            background: 'var(--bg-hover)', 
            borderRadius: '8px', 
            padding: '2rem',
            textAlign: 'center'
          }}>
            <p style={{ marginBottom: '0.5rem' }}>⏳ No Imperial Cup this season</p>
            <p style={{ color: 'var(--text-muted)' }}>
              Next tournament: {selectedYear + (4 - selectedYear % 4)}
            </p>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📜 History</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Winner</th>
              <th>Runner-Up</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.year}>
                <td>{h.year}</td>
                <td className="highlight">🏆 {h.winner}</td>
                <td>{h.runnerUp}</td>
                <td>{h.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Historical record: 17 Origin, 4 Mining Island, 3 First Continent, 1 Second Continent
        </p>
      </div>
    </div>
  );
};

export default ImperialCupPage;
