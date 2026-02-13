import React, { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

const SchedulePage: React.FC = () => {
  const { schedule, teams, userTid, games, week } = useGameStore();

  const scheduleWithTeams = useMemo(() => {
    return schedule
      .filter(g => g.homeTid === userTid || g.awayTid === userTid)
      .map(g => {
        const homeTeam = teams.find(t => t.tid === g.homeTid);
        const awayTeam = teams.find(t => t.tid === g.awayTid);
        const playedGame = games.find(game => game.gid === g.gid);
        
        return {
          ...g,
          homeTeam,
          awayTeam,
          played: !!playedGame,
          homeScore: playedGame?.teams[0]?.pt,
          awayScore: playedGame?.teams[1]?.pt,
          winner: playedGame?.won?.tid
        };
      })
      .sort((a, b) => a.day - b.day);
  }, [schedule, teams, userTid, games]);

  const upcomingGames = scheduleWithTeams.filter(g => !g.played);
  const playedGames = scheduleWithTeams.filter(g => g.played);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📅 Season Schedule</h3>
          <span style={{ color: 'var(--text-muted)' }}>Week {week} of 17</span>
        </div>

        {/* Progress bar */}
        <div style={{ 
          background: 'var(--bg-hover)', 
          borderRadius: '4px', 
          height: '8px',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            borderRadius: '4px',
            height: '100%',
            width: `${Math.min(100, ((week - 1) / 17) * 100)}%`,
            transition: 'width 0.3s'
          }} />
        </div>

        <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Upcoming Games ({upcomingGames.length})
        </h4>
        
        <table className="data-table" style={{ marginBottom: '2rem' }}>
          <thead>
            <tr>
              <th>Week</th>
              <th>Matchup</th>
              <th>Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {upcomingGames.map(game => {
              const isHome = game.homeTid === userTid;
              const opponent = isHome ? game.awayTeam : game.homeTeam;
              
              return (
                <tr key={game.gid}>
                  <td>Week {game.day}</td>
                  <td>
                    {isHome ? (
                      <>
                        <span className="highlight">{game.homeTeam?.name}</span> vs {game.awayTeam?.name}
                      </>
                    ) : (
                      <>
                        {game.awayTeam?.name} @ <span className="highlight">{game.homeTeam?.name}</span>
                      </>
                    )}
                  </td>
                  <td>{isHome ? '🏠 Home' : '✈️ Away'}</td>
                  <td style={{ color: 'var(--warning)' }}>Scheduled</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Completed Games ({playedGames.length})
        </h4>

        <table className="data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Matchup</th>
              <th>Score</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {playedGames.map(game => {
              const isHome = game.homeTid === userTid;
              const userWon = game.winner === userTid;
              
              return (
                <tr key={game.gid}>
                  <td>Week {game.day}</td>
                  <td>
                    {game.awayTeam?.name} @ {game.homeTeam?.name}
                  </td>
                  <td>
                    <span style={{ 
                      fontWeight: isHome ? 600 : 400,
                      color: (isHome ? game.homeScore : game.awayScore) > (isHome ? game.awayScore : game.homeScore) 
                        ? 'var(--success)' : 'var(--text-primary)'
                    }}>
                      {game.awayScore} - {game.homeScore}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: userWon ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: userWon ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {userWon ? 'W' : 'L'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SchedulePage;
