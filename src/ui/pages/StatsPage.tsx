import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

const StatsPage: React.FC = () => {
  const { teams, players, userTid, userTeam, games } = useGameStore();
  const [viewMode, setViewMode] = useState<'team' | 'league'>('team');

  // Team stats
  const teamStats = useMemo(() => {
    const teamGames = games.filter(
      g => g.teams[0]?.tid === userTid || g.teams[1]?.tid === userTid
    );
    
    let totalPF = 0, totalPA = 0;
    teamGames.forEach(g => {
      const isHome = g.teams[0]?.tid === userTid;
      totalPF += isHome ? (g.teams[0]?.pt || 0) : (g.teams[1]?.pt || 0);
      totalPA += isHome ? (g.teams[1]?.pt || 0) : (g.teams[0]?.pt || 0);
    });

    return {
      pf: totalPF,
      pa: totalPA,
      avgPF: teamGames.length > 0 ? (totalPF / teamGames.length).toFixed(1) : '0.0',
      avgPA: teamGames.length > 0 ? (totalPA / teamGames.length).toFixed(1) : '0.0'
    };
  }, [games, userTid]);

  // League leaders (simulated)
  const leagueLeaders = useMemo(() => {
    const topPlayers = players
      .filter(p => p.tid !== undefined && p.tid >= 0)
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 20);

    return topPlayers.map(p => ({
      ...p,
      teamName: teams.find(t => t.tid === p.tid)?.name || 'Unknown',
      passYds: Math.floor(Math.random() * 4000) + 1000,
      passTD: Math.floor(Math.random() * 35) + 10,
      rushYds: Math.floor(Math.random() * 1500) + 500,
      rushTD: Math.floor(Math.random() * 15) + 3,
      recYds: Math.floor(Math.random() * 1200) + 400,
      recTD: Math.floor(Math.random() * 12) + 2
    }));
  }, [players, teams]);

  // Team rankings
  const teamRankings = useMemo(() => {
    return [...teams]
      .map(t => ({
        ...t,
        pointDiff: (t.won * 20) - (t.lost * 10) // Simplified
      }))
      .sort((a, b) => b.pointDiff - a.pointDiff)
      .slice(0, 10);
  }, [teams]);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📈 Statistics</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn btn-sm ${viewMode === 'team' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('team')}
            >
              My Team
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'league' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('league')}
            >
              League
            </button>
          </div>
        </div>

        {viewMode === 'team' ? (
          <>
            <h4 style={{ marginBottom: '1rem' }}>{userTeam?.name} Stats</h4>
            
            <div className="stat-grid" style={{ marginBottom: '2rem' }}>
              <div className="stat-box">
                <div className="stat-value">{teamStats.pf}</div>
                <div className="stat-label">Points For</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{teamStats.pa}</div>
                <div className="stat-label">Points Against</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{teamStats.avgPF}</div>
                <div className="stat-label">Avg PF/Game</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{teamStats.avgPA}</div>
                <div className="stat-label">Avg PA/Game</div>
              </div>
            </div>

            <h4 style={{ marginBottom: '1rem' }}>Roster Summary</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
              {['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S'].map(pos => {
                const posPlayers = players.filter(p => p.tid === userTid && p.pos === pos);
                const avgOvr = posPlayers.length > 0
                  ? Math.round(posPlayers.reduce((sum, p) => sum + p.ovr, 0) / posPlayers.length)
                  : 0;
                return (
                  <div key={pos} style={{ background: 'var(--bg-hover)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                    <div className={`pos-${pos}`} style={{ fontWeight: 600 }}>{pos}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{posPlayers.length} players</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--primary)' }}>{avgOvr}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <h4 style={{ marginBottom: '1rem' }}>League Leaders</h4>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>OVR</th>
                </tr>
              </thead>
              <tbody>
                {leagueLeaders.map((player, i) => (
                  <tr key={player.pid} style={{ 
                    background: player.tid === userTid ? 'rgba(0, 212, 255, 0.1)' : undefined 
                  }}>
                    <td>{i + 1}</td>
                    <td className="highlight">{player.name}</td>
                    <td className={`pos-${player.pos}`}>{player.pos}</td>
                    <td>{player.teamName}</td>
                    <td className={player.ovr >= 80 ? 'ovr-elite' : 'ovr-good'}>{player.ovr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {viewMode === 'league' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🏆 Top Teams</h3>
          </div>
          <div className="stat-grid">
            {teamRankings.map((team, i) => (
              <div 
                key={team.tid} 
                className="stat-box" 
                style={{ 
                  borderLeft: `3px solid ${i < 4 ? 'var(--success)' : i < 8 ? 'var(--warning)' : 'var(--text-muted)'}`
                }}
              >
                <div className="stat-value" style={{ fontSize: '1rem' }}>#{i + 1}</div>
                <div className="stat-label" style={{ color: 'var(--text-primary)' }}>
                  {team.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>
                  {team.won}-{team.lost}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
