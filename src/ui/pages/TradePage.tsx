import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

const formatSalary = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
};

const TradePage: React.FC = () => {
  const { teams, players, userTid, userTeam } = useGameStore();
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [userPlayers, setUserPlayers] = useState<number[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<number[]>([]);
  const [tradeResult, setTradeResult] = useState<{ fair: boolean; value: number } | null>(null);

  const userRoster = useMemo(() => 
    players.filter(p => p.tid === userTid).sort((a, b) => b.ovr - a.ovr),
    [players, userTid]
  );

  const tradePartners = useMemo(() => 
    teams.filter(t => t.tid !== userTid),
    [teams, userTid]
  );

  const partnerRoster = useMemo(() => 
    selectedTeam !== null 
      ? players.filter(p => p.tid === selectedTeam).sort((a, b) => b.ovr - a.ovr)
      : [],
    [players, selectedTeam]
  );

  const calculateValue = (pids: number[]) => {
    return pids.reduce((sum, pid) => {
      const player = players.find(p => p.pid === pid);
      if (!player) return sum;
      // Simple value formula: OVR * age factor * potential factor
      const ageFactor = player.age < 28 ? 1.2 : player.age < 32 ? 1.0 : 0.7;
      const potFactor = player.pot > player.ovr ? 1.2 : 1.0;
      return sum + player.ovr * ageFactor * potFactor * 100000;
    }, 0);
  };

  const evaluateTrade = () => {
    const userValue = calculateValue(userPlayers);
    const partnerValue = calculateValue(teamPlayers);
    const ratio = partnerValue / userValue;
    
    setTradeResult({
      fair: ratio >= 0.85 && ratio <= 1.15,
      value: ratio
    });
  };

  const executeTrade = () => {
    if (!tradeResult?.fair || selectedTeam === null) return;
    // In a real implementation, this would update the database
    alert('Trade executed! (Demo mode - changes not persisted)');
    setUserPlayers([]);
    setTeamPlayers([]);
    setTradeResult(null);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🔄 Trade Center</h3>
        </div>

        {/* Select Trade Partner */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
            Select Trade Partner:
          </label>
          <select 
            className="form-select"
            style={{ 
              background: 'var(--bg-hover)', 
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              width: '100%'
            }}
            value={selectedTeam ?? ''}
            onChange={(e) => {
              setSelectedTeam(Number(e.target.value));
              setUserPlayers([]);
              setTeamPlayers([]);
              setTradeResult(null);
            }}
          >
            <option value="">-- Select a Team --</option>
            {tradePartners.map(team => (
              <option key={team.tid} value={team.tid}>
                {team.name} ({team.won}-{team.lost})
              </option>
            ))}
          </select>
        </div>

        {selectedTeam !== null && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Your Players */}
              <div>
                <h4 style={{ marginBottom: '1rem' }}>
                  <span className="highlight">{userTeam?.name}</span> - Players to Trade
                </h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {userRoster.slice(0, 15).map(player => (
                    <div 
                      key={player.pid}
                      onClick={() => {
                        if (userPlayers.includes(player.pid)) {
                          setUserPlayers(userPlayers.filter(id => id !== player.pid));
                        } else {
                          setUserPlayers([...userPlayers, player.pid]);
                        }
                        setTradeResult(null);
                      }}
                      style={{
                        padding: '0.5rem',
                        background: userPlayers.includes(player.pid) ? 'rgba(0, 212, 255, 0.2)' : 'var(--bg-hover)',
                        borderRadius: '4px',
                        marginBottom: '0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{player.name} ({player.pos})</span>
                      <span className={`pos-${player.pos}`}>{player.ovr} OVR</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                  Value: {formatSalary(calculateValue(userPlayers))}
                </div>
              </div>

              {/* Partner Players */}
              <div>
                <h4 style={{ marginBottom: '1rem' }}>
                  {teams.find(t => t.tid === selectedTeam)?.name} - Players to Receive
                </h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {partnerRoster.slice(0, 15).map(player => (
                    <div 
                      key={player.pid}
                      onClick={() => {
                        if (teamPlayers.includes(player.pid)) {
                          setTeamPlayers(teamPlayers.filter(id => id !== player.pid));
                        } else {
                          setTeamPlayers([...teamPlayers, player.pid]);
                        }
                        setTradeResult(null);
                      }}
                      style={{
                        padding: '0.5rem',
                        background: teamPlayers.includes(player.pid) ? 'rgba(0, 212, 255, 0.2)' : 'var(--bg-hover)',
                        borderRadius: '4px',
                        marginBottom: '0.25rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{player.name} ({player.pos})</span>
                      <span className={`pos-${player.pos}`}>{player.ovr} OVR</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                  Value: {formatSalary(calculateValue(teamPlayers))}
                </div>
              </div>
            </div>

            {/* Trade Actions */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button 
                className="btn btn-secondary"
                onClick={evaluateTrade}
                disabled={userPlayers.length === 0 && teamPlayers.length === 0}
              >
                Evaluate Trade
              </button>
            </div>

            {/* Trade Result */}
            {tradeResult && (
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1rem', 
                background: tradeResult.fair ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ marginBottom: '0.5rem' }}>
                  {tradeResult.fair ? '✅ Fair Trade' : '❌ Unfair Trade'}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Value Ratio: {(tradeResult.value * 100).toFixed(0)}%
                  {tradeResult.value < 0.85 && ' (You get too little)'}
                  {tradeResult.value > 1.15 && ' (You get too much)'}
                </p>
                {tradeResult.fair && (
                  <button 
                    className="btn btn-success"
                    onClick={executeTrade}
                    style={{ marginTop: '1rem' }}
                  >
                    Execute Trade
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TradePage;
