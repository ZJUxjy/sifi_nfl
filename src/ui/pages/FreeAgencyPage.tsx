import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

const formatSalary = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
};

const FreeAgencyPage: React.FC = () => {
  const { players, userTid, userTeam } = useGameStore();
  const [selectedPosition, setSelectedPosition] = useState<string>('all');

  // Mock free agents (players without team or on FA market)
  const freeAgents = useMemo(() => {
    let fa = players.filter(p => p.tid === undefined || p.tid < 0);
    
    // If no FAs in the system, generate some mock ones
    if (fa.length === 0) {
      const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
      fa = Array.from({ length: 50 }, (_, i) => ({
        pid: 10000 + i,
        tid: undefined,
        name: `Free Agent ${i + 1}`,
        age: 24 + Math.floor(Math.random() * 10),
        bornYear: 2000,
        bornLoc: 'Unknown',
        pos: positions[i % positions.length] as any,
        ovr: 60 + Math.floor(Math.random() * 25),
        pot: 60 + Math.floor(Math.random() * 25),
        contract: {
          amount: (50 + Math.floor(Math.random() * 50)) * 100000,
          exp: 2026,
          years: 1 + Math.floor(Math.random() * 3),
          incentives: 0,
          signingBonus: 0,
          guaranteed: 0,
          noTrade: false
        },
        hgt: 70, stre: 70, spd: 70, endu: 70, thv: 70, thp: 70, tha: 70,
        bsc: 70, elu: 70, rtr: 70, hnd: 70, rbk: 70, pbk: 70, pcv: 70,
        tck: 70, prs: 70, rns: 70, kpw: 70, kac: 70, ppw: 70, pac: 70,
        fuzz: 0, ovrs: {}, pots: {}, ratingsIndex: 0, statsIndex: 0,
        draft: { year: 2020, round: 1, pick: 1, tid: 0, originalTid: 0, pot: 70, ovr: 60, skills: [] },
        numBrothers: 0, numSons: 0
      }));
    }

    if (selectedPosition !== 'all') {
      fa = fa.filter(p => p.pos === selectedPosition);
    }

    return fa.sort((a, b) => b.ovr - a.ovr);
  }, [players, selectedPosition]);

  const positions = ['all', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];

  const handleSign = (player: any) => {
    alert(`Signed ${player.name}! (Demo mode - changes not persisted)`);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Free Agency Market</h3>
          <span style={{ color: 'var(--text-muted)' }}>{freeAgents.length} players available</span>
        </div>

        {/* Position Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {positions.map(pos => (
            <button
              key={pos}
              className={`btn btn-sm ${selectedPosition === pos ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedPosition(pos)}
            >
              {pos === 'all' ? 'All' : pos}
            </button>
          ))}
        </div>

        {/* Free Agents Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Pos</th>
                <th>Name</th>
                <th>Age</th>
                <th>OVR</th>
                <th>POT</th>
                <th>Asking</th>
                <th>Years</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {freeAgents.slice(0, 30).map(player => (
                <tr key={player.pid}>
                  <td className={`pos-${player.pos}`}>{player.pos}</td>
                  <td className="highlight">{player.name}</td>
                  <td>{player.age}</td>
                  <td className={player.ovr >= 75 ? 'ovr-elite' : player.ovr >= 65 ? 'ovr-good' : 'ovr-average'}>
                    {player.ovr}
                  </td>
                  <td>{player.pot}</td>
                  <td>{formatSalary(player.contract?.amount || 0)}</td>
                  <td>{player.contract?.years || 1}</td>
                  <td>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSign(player)}
                    >
                      Sign
                    </button>
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

export default FreeAgencyPage;
