import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Game } from '../../common/types';

const PlayPage: React.FC = () => {
  const { week, playWeek, simWeek, teams, userTid, userTeam } = useGameStore();
  const [playing, setPlaying] = useState(false);
  const [lastGame, setLastGame] = useState<Game | null>(null);
  const [playByPlay, setPlayByPlay] = useState<string[]>([]);

  const handlePlayWeek = async () => {
    setPlaying(true);
    setPlayByPlay([]);
    
    // Generate fake play-by-play
    const plays = generateFakePlayByPlay();
    for (let i = 0; i < plays.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setPlayByPlay(prev => [...prev, plays[i]]);
    }

    const game = await playWeek();
    setLastGame(game || null);
    setPlaying(false);
  };

  const handleSimWeek = async () => {
    setPlaying(true);
    await simWeek();
    setPlaying(false);
  };

  const generateFakePlayByPlay = (): string[] => {
    const plays: string[] = [];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    
    quarters.forEach(q => {
      plays.push(`\n[${q}] --- Start of ${q} ---`);
      
      // Add some random plays
      const numPlays = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < numPlays; i++) {
        const playType = Math.random();
        if (playType < 0.4) {
          const yards = Math.floor(Math.random() * 15);
          plays.push(`${q}: Pass complete for ${yards} yards`);
        } else if (playType < 0.7) {
          const yards = Math.floor(Math.random() * 10);
          plays.push(`${q}: Run up the middle for ${yards} yards`);
        } else if (playType < 0.85) {
          plays.push(`${q}: Pass incomplete`);
        } else if (playType < 0.95) {
          plays.push(`${q}: ⚠️ Penalty - Holding, 10 yards`);
        } else {
          plays.push(`${q}: 🎯 TOUCHDOWN!`);
        }
      }
    });

    return plays;
  };

  const getNextOpponent = () => {
    const userGames = useGameStore.getState().schedule.filter(
      g => g.day === week && (g.homeTid === userTid || g.awayTid === userTid)
    );
    if (userGames.length === 0) return null;
    
    const game = userGames[0];
    const isHome = game.homeTid === userTid;
    const opponent = teams.find(t => t.tid === (isHome ? game.awayTid : game.homeTid));
    
    return { opponent, isHome, game };
  };

  const nextGame = getNextOpponent();

  if (week > 17) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏈 Regular Season Complete</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          The regular season has ended. Check the standings for playoff picture!
        </p>
        <div className="stat-grid">
          <div className="stat-box">
            <div className="stat-value">{userTeam?.won || 0}</div>
            <div className="stat-label">Wins</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{userTeam?.lost || 0}</div>
            <div className="stat-label">Losses</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">▶️ Play Week {week}</h3>
        </div>

        {nextGame && (
          <div className="game-score">
            <div className="game-team">
              <div className="game-team-name">
                {nextGame.isHome ? (
                  <span className="highlight">{userTeam?.name}</span>
                ) : (
                  nextGame.opponent?.name
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {nextGame.isHome ? 'Home' : 'Away'}
              </div>
            </div>
            
            <div className="game-vs">VS</div>
            
            <div className="game-team">
              <div className="game-team-name">
                {nextGame.isHome ? (
                  nextGame.opponent?.name
                ) : (
                  <span className="highlight">{userTeam?.name}</span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {nextGame.isHome ? 'Away' : 'Home'}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={handlePlayWeek}
            disabled={playing}
          >
            {playing ? '⏳ Playing...' : '▶️ Play Week'}
          </button>
          <button 
            className="btn btn-secondary btn-lg" 
            onClick={handleSimWeek}
            disabled={playing}
          >
            ⚡ Sim Week
          </button>
        </div>
      </div>

      {/* Play by Play */}
      {playByPlay.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📝 Play by Play</h3>
          </div>
          <div className="play-log">
            {playByPlay.map((play, i) => (
              <div 
                key={i} 
                className={`play-item ${
                  play.includes('TOUCHDOWN') ? 'play-touchdown' : 
                  play.includes('Penalty') ? 'play-turnover' : ''
                }`}
              >
                {play}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Game Result */}
      {lastGame && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📊 Final Score</h3>
          </div>
          
          <div className="game-score">
            <div className="game-team">
              <div className="game-team-name">
                {teams.find(t => t.tid === lastGame.teams[0].tid)?.name}
              </div>
              <div className="game-team-score">{lastGame.teams[0].pt}</div>
            </div>
            
            <div className="game-vs">-</div>
            
            <div className="game-team">
              <div className="game-team-name">
                {teams.find(t => t.tid === lastGame.teams[1].tid)?.name}
              </div>
              <div className="game-team-score">{lastGame.teams[1].pt}</div>
            </div>
          </div>

          <div className={`game-status ${lastGame.won.tid === userTid ? 'winner' : 'loser'}`}>
            {lastGame.won.tid === userTid ? '🏆 VICTORY!' : '😞 DEFEAT'}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayPage;
