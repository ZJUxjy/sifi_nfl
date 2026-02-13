import React, { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

const StandingsPage: React.FC = () => {
  const { teams, userTid, schedule, games, week } = useGameStore();

  // Calculate standings
  const standings = useMemo(() => {
    return [...teams]
      .map(team => {
        const winPct = team.won + team.lost > 0 
          ? (team.won / (team.won + team.lost) * 100).toFixed(1)
          : '0.0';
        
        // Calculate points for/against (simplified)
        const teamGames = games.filter(
          g => (g.teams[0]?.tid === team.tid || g.teams[1]?.tid === team.tid)
        );
        
        let pf = 0, pa = 0;
        teamGames.forEach(g => {
          const isHome = g.teams[0]?.tid === team.tid;
          if (isHome) {
            pf += g.teams[0]?.pt || 0;
            pa += g.teams[1]?.pt || 0;
          } else {
            pf += g.teams[1]?.pt || 0;
            pa += g.teams[0]?.pt || 0;
          }
        });

        return {
          ...team,
          winPct,
          pf,
          pa,
          streak: team.won > team.lost ? `W${Math.min(team.won, 5)}` : `L${Math.min(team.lost, 5)}`
        };
      })
      .sort((a, b) => {
        // Sort by wins, then win percentage
        if (b.won !== a.won) return b.won - a.won;
        return parseFloat(b.winPct) - parseFloat(a.winPct);
      });
  }, [teams, games]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏆 League Standings</h3>
          <span style={{ color: 'var(--text-muted)' }}>Week {week}</span>
        </div>

        <table className="data-table standings-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>Pct</th>
              <th>PF</th>
              <th>PA</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team, index) => (
              <tr 
                key={team.tid} 
                className={team.tid === userTid ? 'user-team' : ''}
              >
                <td>{index + 1}</td>
                <td className="team-name">
                  {team.tid === userTid && <span style={{ color: 'var(--primary)' }}>⭐</span>}
                  <span className={team.tid === userTid ? 'highlight' : ''}>
                    {team.name}
                  </span>
                </td>
                <td>{team.won}</td>
                <td>{team.lost}</td>
                <td>{team.winPct}</td>
                <td>{team.pf}</td>
                <td>{team.pa}</td>
                <td className={team.streak.startsWith('W') ? 'streak-win' : 'streak-loss'}>
                  {team.streak}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top 5 Teams Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏆 Playoff Picture</h3>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Top teams qualify for the playoffs
        </p>
        <div className="stat-grid">
          {standings.slice(0, 5).map((team, i) => (
            <div key={team.tid} className="stat-box" style={{ 
              borderLeft: `3px solid ${i < 4 ? 'var(--success)' : 'var(--warning)'}` 
            }}>
              <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                #{i + 1}
              </div>
              <div className="stat-label" style={{ color: 'var(--text-primary)' }}>
                {team.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {team.won}-{team.lost}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StandingsPage;
