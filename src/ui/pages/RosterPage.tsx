import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Player } from '../../common/types';

const positionOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];

const getOvrClass = (ovr: number): string => {
  if (ovr >= 80) return 'ovr-elite';
  if (ovr >= 70) return 'ovr-good';
  if (ovr >= 60) return 'ovr-average';
  return 'ovr-poor';
};

const formatSalary = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
};

const RosterPage: React.FC = () => {
  const { players, userTid } = useGameStore();
  const [sortBy, setSortBy] = useState<'pos' | 'ovr' | 'age' | 'pot'>('ovr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [positionFilter, setPositionFilter] = useState<string>('all');

  const teamPlayers = useMemo(() => {
    let filtered = players.filter(p => p.tid === userTid);

    if (positionFilter !== 'all') {
      filtered = filtered.filter(p => p.pos === positionFilter);
    }

    return filtered.sort((a, b) => {
      let cmp = 0;
      
      if (sortBy === 'pos') {
        cmp = positionOrder.indexOf(a.pos) - positionOrder.indexOf(b.pos);
      } else if (sortBy === 'ovr') {
        cmp = a.ovr - b.ovr;
      } else if (sortBy === 'age') {
        cmp = a.age - b.age;
      } else if (sortBy === 'pot') {
        cmp = a.pot - b.pot;
      }

      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [players, userTid, sortBy, sortDir, positionFilter]);

  const handleSort = (column: 'pos' | 'ovr' | 'age' | 'pot') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  const positions = ['all', ...positionOrder];

  // Calculate roster stats
  const avgOvr = teamPlayers.length > 0 
    ? Math.round(teamPlayers.reduce((sum, p) => sum + p.ovr, 0) / teamPlayers.length)
    : 0;
  const avgAge = teamPlayers.length > 0
    ? Math.round(teamPlayers.reduce((sum, p) => sum + p.age, 0) / teamPlayers.length * 10) / 10
    : 0;
  const totalSalary = teamPlayers.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏈 Team Roster ({teamPlayers.length} players)</h3>
        </div>
        
        <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-box">
            <div className="stat-value">{avgOvr}</div>
            <div className="stat-label">Avg OVR</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{avgAge}</div>
            <div className="stat-label">Avg Age</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{formatSalary(totalSalary)}</div>
            <div className="stat-label">Total Salary</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {positions.map(pos => (
            <button
              key={pos}
              className={`btn btn-sm ${positionFilter === pos ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPositionFilter(pos)}
            >
              {pos === 'all' ? 'All' : pos}
            </button>
          ))}
        </div>

        {/* Roster Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('pos')} style={{ cursor: 'pointer' }}>
                  Pos {sortBy === 'pos' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th>Name</th>
                <th onClick={() => handleSort('age')} style={{ cursor: 'pointer' }}>
                  Age {sortBy === 'age' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th onClick={() => handleSort('ovr')} style={{ cursor: 'pointer' }}>
                  OVR {sortBy === 'ovr' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th onClick={() => handleSort('pot')} style={{ cursor: 'pointer' }}>
                  POT {sortBy === 'pot' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th>Salary</th>
                <th>Years</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {teamPlayers.map(player => (
                <tr key={player.pid}>
                  <td className={`pos-${player.pos}`}>{player.pos}</td>
                  <td className="highlight">{player.name}</td>
                  <td>{player.age}</td>
                  <td className={getOvrClass(player.ovr)}>{player.ovr}</td>
                  <td className={getOvrClass(player.pot)}>{player.pot}</td>
                  <td>{formatSalary(player.contract?.amount || 0)}</td>
                  <td>{player.contract?.years || '-'}</td>
                  <td style={{ color: player.injury ? 'var(--danger)' : 'var(--success)' }}>
                    {player.injury ? `Injured (${player.injury.gamesRemaining} games)` : 'Healthy'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RosterPage;
