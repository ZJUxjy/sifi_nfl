import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import type { Region } from '../../common/types';

const regions: { id: Region; name: string; teams: number; desc: string }[] = [
  { 
    id: 'firstContinent', 
    name: '🌍 First Continent', 
    teams: 36,
    desc: 'Closed league, salary cap'
  },
  { 
    id: 'secondContinent', 
    name: '🌎 Second Continent', 
    teams: 40,
    desc: 'Closed league, salary cap'
  },
  { 
    id: 'originContinent', 
    name: '🏛️ Origin Continent', 
    teams: 36,
    desc: '3 leagues with promotion/relegation'
  },
  { 
    id: 'miningIsland', 
    name: '⛏️ Mining Island', 
    teams: 58,
    desc: '4-tier pyramid system'
  }
];

const TeamSelectModal: React.FC = () => {
  const { initGame } = useGameStore();
  const [step, setStep] = useState<'region' | 'team'>('region');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<number>(0);

  const teams = selectedRegion ? useGameStore.getState().teams.length > 0 
    ? useGameStore.getState().teams 
    : Array.from({ length: regions.find(r => r.id === selectedRegion)?.teams || 36 }, (_, i) => ({
        tid: i,
        name: getTeamName(i, selectedRegion),
        strength: getTeamStrength(i),
        market: getTeamMarket(i),
        budget: getTeamBudget(i)
      })) 
    : [];

  function getTeamName(index: number, region: Region): string {
    const names: Record<Region, string[]> = {
      firstContinent: ['Aurora Sentinels', 'Pixel Pirates', 'Titan Titans', 'Quantum Reapers',
        'Ion Storm', 'Stack Stormers', 'Thread Threshers', 'Compile Kings', 'Null Knights',
        'Neural Network', 'Debug Destroyers', 'Heap Hammers', 'Nebula Knights', 'Nova Force',
        'Syntax Soldiers', 'Binary Blazers', 'Cache Crushers', 'Logic Lords', 'Pixel Pioneers',
        'Data Dragons', 'Cyber Centurions', 'Matrix Marauders', 'Vector Vipers', 'Byte Brawlers',
        'Code Commanders', 'Algorithm Avengers', 'Protocol Phantoms', 'Circuit Champions',
        'Digital Demons', 'Virtual Vanguards', 'Hologram Heroes', 'Plasma Prowlers',
        'Quantum Questers', 'Stellar Strikers', 'Galaxy Guardians', 'Cosmo Crusaders'],
      secondContinent: Array.from({ length: 40 }, (_, i) => `Team ${i + 1} SC`),
      originContinent: ['Metropolis Emperors', 'Imperial Raiders', 'Royal Lions', 
        'Origin Eagles', 'Capital Defenders', 'Palace Guards'].concat(
        Array.from({ length: 30 }, (_, i) => `Origin Team ${i + 7}`)
      ),
      miningIsland: Array.from({ length: 58 }, (_, i) => `Mining Team ${i + 1}`)
    };
    return names[region][index] || `Team ${index + 1}`;
  }

  function getTeamStrength(index: number): string {
    const strengths = ['⭐⭐⭐', '⭐⭐', '⭐', ''];
    return strengths[index % 4];
  }

  function getTeamMarket(index: number): string {
    const markets = ['💰💰💰', '💰💰', '💰', ''];
    return markets[index % 4];
  }

  function getTeamBudget(index: number): number {
    const budgets = [300, 240, 200, 140];
    return budgets[index % 4];
  }

  const handleRegionSelect = (region: Region) => {
    setSelectedRegion(region);
    setStep('team');
  };

  const handleTeamSelect = () => {
    if (selectedRegion !== null) {
      initGame(selectedRegion, selectedTeam);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: step === 'team' ? '700px' : '500px' }}>
        <div className="modal-header">
          <h2>{step === 'region' ? '🌍 Select Your Region' : '🏈 Select Your Team'}</h2>
        </div>

        {step === 'region' ? (
          <div className="team-grid">
            {regions.map(region => (
              <div
                key={region.id}
                className={`team-option ${selectedRegion === region.id ? 'selected' : ''}`}
                onClick={() => handleRegionSelect(region.id)}
              >
                <div className="name">{region.name}</div>
                <div className="info">{region.teams} teams</div>
                <div className="info">{region.desc}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setStep('region')}>
                ← Back to Regions
              </button>
              <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>
                {regions.find(r => r.id === selectedRegion)?.name}
              </span>
            </div>
            
            <div className="team-grid" style={{ maxHeight: '300px' }}>
              {Array.from({ length: regions.find(r => r.id === selectedRegion)?.teams || 36 }, (_, i) => (
                <div
                  key={i}
                  className={`team-option ${selectedTeam === i ? 'selected' : ''}`}
                  onClick={() => setSelectedTeam(i)}
                >
                  <div className="name">{getTeamName(i, selectedRegion!)}</div>
                  <div className="stars">{getTeamStrength(i)}</div>
                  <div className="money">{getTeamMarket(i)} ${getTeamBudget(i)}M</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button className="btn btn-primary btn-lg" onClick={handleTeamSelect}>
                🏈 Start Game
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TeamSelectModal;
