import { useState, useEffect } from 'react';
import { Button, Modal, Row, Col, Badge, Spinner } from 'react-bootstrap';
import { useGameStore, useUserTeam } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import type { Region } from '../../common/types';
import type { Team, Player } from '../../common/entities';
import teamsData from '../../data/initial-teams.json';
import playersData from '../../data/initial-players.json';

interface MainMenuProps {
  onStartGame: () => void;
}

const REGIONS: { id: Region; name: string; description: string; teams: number }[] = [
  { id: 'firstContinent', name: '🌍 First Continent', description: 'Closed league, 36 teams', teams: 36 },
  { id: 'secondContinent', name: '🌎 Second Continent', description: 'Closed league, 40 teams', teams: 40 },
  { id: 'originContinent', name: '🏛️ Origin Continent', description: '3 leagues with promotion/relegation', teams: 36 },
  { id: 'miningIsland', name: '⛏️ Mining Island', description: '4-tier pyramid system', teams: 80 },
];

function MainMenu({ onStartGame }: MainMenuProps) {
  const { loading, initGame, resetGame, teams: storeTeams } = useGameStore();
  const currentTeam = useUserTeam();

  const [showNewGame, setShowNewGame] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);

  const regionTeams = selectedRegion
    ? teams.filter((t) => t.region === selectedRegion)
    : [];

  // Load teams data when opening new game modal
  const handleNewGame = async () => {
    setShowNewGame(true);
    setTeams([]);
    setIsInitializing(true);

    try {
      // Try to load cached data first
      const { loadWorldData } = await import('@worker/api/storage');
      const cachedData = await loadWorldData();

      if (cachedData && cachedData.teams && cachedData.teams.length > 0) {
        console.log('Using cached world data for team selection');
        setTeams(cachedData.teams);
      } else {
        // No cache, use pre-imported data and cache it
        console.log('No cached data, loading from pre-imported JSON...');

        const teams = teamsData as unknown as Team[];
        const players = playersData;

        // Cache to IndexedDB for next time
        const { initDB, saveWorldData } = await import('@worker/api/storage');
        await initDB();

        const season = 2025;
        const freeAgents: Player[] = [];

        await saveWorldData({
          season,
          teams,
          players,
          freeAgents,
          timestamp: Date.now(),
        });

        console.log('Loaded and cached world data');
        setTeams(teams);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  // Helper function to generate and cache world data (fallback, removed)
  const generateAndCacheWorld = async (engine: any) => {
    // This function is no longer needed since we use import for JSON files
    console.log('generateAndCacheWorld should not be called anymore');
  };

  const handleSelectRegion = (regionId: Region) => {
    setSelectedRegion(regionId);
    setSelectedTeamIndex(null);
  };

  const handleConfirmTeam = async () => {
    if (selectedTeamIndex !== null && selectedRegion !== null && regionTeams[selectedTeamIndex]) {
      const team = regionTeams[selectedTeamIndex];
      console.log('Confirm team:', team.name, 'region:', selectedRegion, 'tid:', team.tid);

      // Now properly initialize the game with the selected team
      setIsInitializing(true);
      console.log('Calling initGame...');
      await initGame(selectedRegion, team.tid);
      console.log('initGame completed');
      setIsInitializing(false);

      setShowNewGame(false);
      onStartGame();
    }
  };

  const getMarketIcon = (budget: number) => {
    if (budget >= 300000) return '💰💰💰';
    if (budget >= 240000) return '💰💰';
    if (budget >= 200000) return '💰';
    return '';
  };

  const getStrengthStars = (team: Team) => {
    // This would need to be calculated from team config
    return '⭐⭐';
  };

  // Show loading screen while engine is working
  if (loading || isInitializing) {
    return (
      <div className="main-menu text-center">
        <div className="loading-spinner d-flex flex-column align-items-center gap-3">
          <Spinner animation="border" style={{ width: '3rem', height: '3rem' }} />
          <h4>Loading universe...</h4>
          <p className="text-muted">This may take a moment on first launch...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-menu text-center">
      <h1 className="display-4 mb-4" style={{ color: '#00d4ff' }}>
        🏈 SIFI NFL
      </h1>
      <p className="lead mb-5 text-muted">
        Sci-Fi American Football Manager
      </p>

      <div className="d-flex flex-column align-items-center gap-3">
        <Button className="menu-btn w-100" style={{ maxWidth: 300 }} onClick={handleNewGame}>
          🎮 New Game
        </Button>

        {currentTeam && (
          <Button
            className="menu-btn w-100"
            style={{ maxWidth: 300 }}
            onClick={() => {
              onStartGame();
            }}
          >
            ▶️ Continue as {currentTeam.name}
          </Button>
        )}

        <Button
          className="menu-btn w-100"
          style={{ maxWidth: 300 }}
          variant="outline-danger"
          onClick={() => {
            if (confirm('Are you sure you want to reset the game?')) {
              resetGame();
            }
          }}
        >
          🗑️ Reset Game
        </Button>
      </div>

      {/* New Game Modal */}
      <Modal show={showNewGame} onHide={() => setShowNewGame(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>Select Your Team</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {teams.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">Loading teams...</p>
            </div>
          ) : !selectedRegion ? (
            <>
              <h5 className="mb-4">Choose your region:</h5>
              <Row>
                {REGIONS.map((region) => (
                  <Col md={6} key={region.id}>
                    <div
                      className="region-card"
                      onClick={() => handleSelectRegion(region.id)}
                    >
                      <h4>{region.name}</h4>
                      <p>{region.description}</p>
                      <Badge bg="secondary">{region.teams} teams</Badge>
                    </div>
                  </Col>
                ))}
              </Row>
            </>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <Button variant="outline-primary" onClick={() => setSelectedRegion(null)}>
                  ← Back to Regions
                </Button>
                <h5 className="mb-0">
                  {REGIONS.find((r) => r.id === selectedRegion)?.name} - Select your team:
                </h5>
                <div></div>
              </div>

              <Row className="team-grid" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {regionTeams.map((team, index) => (
                  <Col md={4} lg={3} key={team.tid} className="mb-3">
                    <div
                      className={`game-card team-card p-3 ${selectedTeamIndex === index ? 'selected' : ''}`}
                      onClick={() => setSelectedTeamIndex(index)}
                    >
                      <h6 className="mb-2">{team.name}</h6>
                      <div className="d-flex justify-content-between">
                        <small>{getMarketIcon(team.budget)}</small>
                        <small>{getStrengthStars(team)}</small>
                      </div>
                      <div className="mt-2">
                        <small className="text-muted">
                          ${(team.budget / 1000).toFixed(0)}K Budget
                        </small>
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNewGame(false)}>
            Cancel
          </Button>
          {selectedTeamIndex !== null && (
            <Button variant="primary" onClick={handleConfirmTeam} disabled={isInitializing}>
              {isInitializing ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Initializing...
                </>
              ) : (
                `Start Managing ${regionTeams[selectedTeamIndex]?.name}`
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default MainMenu;
