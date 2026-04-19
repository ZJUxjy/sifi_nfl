import { useState, useMemo, useCallback } from 'react';
import { Card, Table, Button, Badge, Modal, Form, Alert, Tabs, Tab, Row, Col } from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import { ORIGIN_DRAFT_ELIGIBILITY } from '@common/constants.football';
import type { Player, Team } from '@common/entities';
import type { Region } from '@common/types';
import type { OriginDraftResult } from '../../worker/api/types';

interface OriginDraftViewProps {
  team: Team;
}

type DraftStatus = 'viewing' | 'selecting' | 'complete';

interface DraftPick {
  pick: number;
  teamTid: number;
  playerPid: number | null;
  bidAmount: number;
}

// Check if a player is eligible for Origin Draft based on their team's region
function isEligibleForOriginDraft(player: Player, teams: Team[], season: number): { eligible: boolean; reason: string } {
  // Get player's team to determine region
  const playerTeam = teams.find(t => t.tid === player.tid);
  if (!playerTeam) {
    return { eligible: false, reason: 'Not on a team' };
  }

  const region = playerTeam.region as Region;

  // Origin Continent players are not eligible (they are the ones drafting)
  if (region === 'originContinent') {
    return { eligible: false, reason: 'Origin Continent players are not eligible' };
  }

  const config = ORIGIN_DRAFT_ELIGIBILITY[region as keyof typeof ORIGIN_DRAFT_ELIGIBILITY];

  if (!config) {
    return { eligible: false, reason: 'Not from a draft-eligible region' };
  }

  // Check age requirement (only for regions that have this requirement)
  if ('minAge' in config && config.minAge && player.age < config.minAge) {
    return { eligible: false, reason: `Must be ${config.minAge}+ years old (is ${player.age})` };
  }

  // Check seasons requirement
  if (config.minSeasons) {
    const draftYear = player.draft?.year || season;
    const seasonsPlayed = season - draftYear;
    if (seasonsPlayed < config.minSeasons) {
      return { eligible: false, reason: `Must have ${config.minSeasons}+ seasons (has ${seasonsPlayed})` };
    }
  }

  return { eligible: true, reason: 'Eligible' };
}

// Get eligible players for Origin Draft
function getEligiblePlayers(players: Player[], teams: Team[], season: number): Player[] {
  return players.filter(p => {
    const { eligible } = isEligibleForOriginDraft(p, teams, season);
    return eligible && p.tid !== undefined && p.tid >= 0; // Must be on a team
  });
}

function OriginDraftView({ team }: OriginDraftViewProps) {
  const { season, players, teams } = useGameStore();
  const [status, setStatus] = useState<DraftStatus>('viewing');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState(0);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [showBidModal, setShowBidModal] = useState(false);
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<Region | 'all'>('all');

  // Only Origin Continent teams can participate
  const canParticipate = team.region === 'originContinent';

  // Get eligible players
  const eligiblePlayers = useMemo(() => {
    return getEligiblePlayers(players, teams, season);
  }, [players, teams, season]);

  // Filter eligible players
  const filteredPlayers = useMemo(() => {
    let filtered = eligiblePlayers;

    if (positionFilter !== 'all') {
      filtered = filtered.filter(p => p.pos === positionFilter);
    }

    if (regionFilter !== 'all') {
      // Filter by player's team region
      filtered = filtered.filter(p => {
        const playerTeam = teams.find(t => t.tid === p.tid);
        return playerTeam?.region === regionFilter;
      });
    }

    // Sort by OVR descending
    return [...filtered].sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
  }, [eligiblePlayers, positionFilter, regionFilter, teams]);

  // Get origin continent teams for draft order
  const originTeams = useMemo(() => {
    return teams
      .filter(t => t.region === 'originContinent')
      .sort((a, b) => (a.budget || 0) - (b.budget || 0)); // Poorest teams pick first
  }, [teams]);

  // Calculate recommended bid based on player OVR
  const getRecommendedBid = (player: Player): number => {
    const baseOvr = player.ovr || 50;
    const multiplier = Math.pow(baseOvr / 50, 2);
    return Math.round(500000 * multiplier);
  };

  // Handle player selection
  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setBidAmount(getRecommendedBid(player));
    setShowBidModal(true);
  };

  // Handle bid submission
  const handleSubmitBid = useCallback(() => {
    if (!selectedPlayer) return;

    const engine = getGameEngine();

    // Simulate other teams' bids
    const teamBids: { tid: number; bid: number }[] = [];

    for (const t of originTeams) {
      if (t.tid === team.tid) {
        teamBids.push({ tid: t.tid, bid: bidAmount });
      } else {
        // AI teams bid based on player value and team budget
        const aiBid = Math.round(getRecommendedBid(selectedPlayer) * (0.8 + Math.random() * 0.4));
        if (aiBid <= (t.budget || 0) * 0.1) {
          teamBids.push({ tid: t.tid, bid: Math.min(aiBid, (t.budget || 1000000) * 0.1) });
        }
      }
    }

    // Sort by bid descending
    teamBids.sort((a, b) => b.bid - a.bid);

    // Winner
    const winner = teamBids[0];

    const newPick: DraftPick = {
      pick: currentPick,
      teamTid: winner!.tid,
      playerPid: selectedPlayer.pid,
      bidAmount: winner!.bid,
    };

    // Execute the origin draft pick in the game engine
    const result = engine.executeOriginDraftPick(
      selectedPlayer.pid,
      winner!.tid,
      winner!.bid
    );

    if (result.success) {
      setDraftPicks(prev => [...prev, newPick]);
      setCurrentPick(prev => prev + 1);
    } else {
      console.error('Origin draft pick failed:', result.reason);
    }

    setShowBidModal(false);
    setSelectedPlayer(null);
  }, [selectedPlayer, bidAmount, originTeams, team.tid, currentPick]);

  // Check if draft is complete
  const isDraftComplete = draftPicks.length >= Math.min(eligiblePlayers.length, originTeams.length * 2);

  // Get drafted players
  const draftedPids = useMemo(() => {
    return new Set(draftPicks.map(p => p.playerPid));
  }, [draftPicks]);

  if (!canParticipate) {
    return (
      <Card className="p-4">
        <Alert variant="info">
          <h5>Origin Draft Unavailable</h5>
          <p className="mb-0">
            Only Origin Continent teams can participate in the Origin Draft.
            Your team is in the {team.region} region.
          </p>
        </Alert>
      </Card>
    );
  }

  return (
    <div className="origin-draft-view">
      <Card className="p-4 mb-4">
        <Row className="align-items-center">
          <Col>
            <h4>Origin Draft - Season {season}</h4>
            <p className="text-muted mb-0">
              Cross-region draft to acquire top talent from other continents
            </p>
          </Col>
          <Col xs="auto">
            <Badge bg="secondary" className="me-2">
              Pick {currentPick} of {Math.min(eligiblePlayers.length, originTeams.length * 2)}
            </Badge>
            <Badge bg={isDraftComplete ? 'success' : 'warning'}>
              {isDraftComplete ? 'Complete' : 'In Progress'}
            </Badge>
          </Col>
        </Row>
      </Card>

      {/* Eligibility Rules */}
      <Card className="p-3 mb-4">
        <h6>Eligibility Requirements</h6>
        <Row>
          <Col md={3}>
            <Badge bg="primary" className="mb-2">First Continent</Badge>
            <p className="small mb-0">Age 25+</p>
          </Col>
          <Col md={3}>
            <Badge bg="success" className="mb-2">Second Continent</Badge>
            <p className="small mb-0">Age 24+ + 2 seasons</p>
          </Col>
          <Col md={3}>
            <Badge bg="warning" className="mb-2">Mining Island</Badge>
            <p className="small mb-0">3+ seasons service</p>
          </Col>
          <Col md={3}>
            <Badge bg="info" className="mb-2">Compensation</Badge>
            <p className="small mb-0">10% salary + bid to original team</p>
          </Col>
        </Row>
      </Card>

      <Tabs defaultActiveKey="available" className="mb-3">
        <Tab eventKey="available" title={`Available (${filteredPlayers.length})`}>
          {/* Filters */}
          <Card className="p-3 mb-3">
            <Row>
              <Col md={4}>
                <Form.Select
                  value={positionFilter}
                  onChange={(e) => setPositionFilter(e.target.value)}
                >
                  <option value="all">All Positions</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="OL">OL</option>
                  <option value="DL">DL</option>
                  <option value="LB">LB</option>
                  <option value="CB">CB</option>
                  <option value="S">S</option>
                  <option value="K">K</option>
                  <option value="P">P</option>
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value as Region | 'all')}
                >
                  <option value="all">All Regions</option>
                  <option value="firstContinent">First Continent</option>
                  <option value="secondContinent">Second Continent</option>
                  <option value="miningIsland">Mining Island</option>
                </Form.Select>
              </Col>
            </Row>
          </Card>

          {/* Available Players */}
          <Table striped hover responsive>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Age</th>
                <th>OVR</th>
                <th>Region</th>
                <th>Current Team</th>
                <th>Est. Bid</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.slice(0, 50).map(player => {
                const isDrafted = draftedPids.has(player.pid);
                const currentTeam = teams.find(t => t.tid === player.tid);

                return (
                  <tr key={player.pid} className={isDrafted ? 'table-secondary' : ''}>
                    <td>
                      <strong>{player.name}</strong>
                      {isDrafted && <Badge bg="secondary" className="ms-2">Drafted</Badge>}
                    </td>
                    <td><Badge bg="secondary">{player.pos}</Badge></td>
                    <td>{player.age}</td>
                    <td>
                      <Badge bg={player.ovr >= 80 ? 'success' : player.ovr >= 70 ? 'primary' : 'secondary'}>
                        {player.ovr}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={
                        currentTeam?.region === 'firstContinent' ? 'primary' :
                        currentTeam?.region === 'secondContinent' ? 'success' :
                        'warning'
                      }>
                        {currentTeam?.region === 'firstContinent' ? '1st' :
                         currentTeam?.region === 'secondContinent' ? '2nd' :
                         'Mining'}
                      </Badge>
                    </td>
                    <td>{currentTeam?.abbrev || 'FA'}</td>
                    <td>${(getRecommendedBid(player) / 1000).toFixed(0)}K</td>
                    <td>
                      {!isDrafted && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleSelectPlayer(player)}
                          disabled={isDraftComplete}
                        >
                          Bid
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {filteredPlayers.length === 0 && (
            <Alert variant="info" className="m-3">
              No eligible players match your filters.
            </Alert>
          )}
        </Tab>

        <Tab eventKey="picks" title={`Draft Picks (${draftPicks.length})`}>
          <Table striped hover>
            <thead>
              <tr>
                <th>Pick</th>
                <th>Team</th>
                <th>Player</th>
                <th>Pos</th>
                <th>OVR</th>
                <th>Winning Bid</th>
              </tr>
            </thead>
            <tbody>
              {draftPicks.map(pick => {
                const draftTeam = teams.find(t => t.tid === pick.teamTid);
                const player = players.find(p => p.pid === pick.playerPid);

                return (
                  <tr key={pick.pick} className={pick.teamTid === team.tid ? 'table-success' : ''}>
                    <td>{pick.pick}</td>
                    <td>
                      {draftTeam?.name}
                      {pick.teamTid === team.tid && (
                        <Badge bg="success" className="ms-2">Your Pick</Badge>
                      )}
                    </td>
                    <td>{player?.name || 'Unknown'}</td>
                    <td>{player?.pos}</td>
                    <td>{player?.ovr}</td>
                    <td>${(pick.bidAmount / 1000).toFixed(0)}K</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {draftPicks.length === 0 && (
            <Alert variant="info" className="m-3">
              No picks have been made yet. Select a player to start bidding.
            </Alert>
          )}
        </Tab>
      </Tabs>

      {/* Bid Modal */}
      <Modal show={showBidModal} onHide={() => setShowBidModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Submit Bid for {selectedPlayer?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPlayer && (
            <>
              <Row className="mb-3">
                <Col>
                  <strong>Position:</strong> {selectedPlayer.pos}
                </Col>
                <Col>
                  <strong>OVR:</strong> {selectedPlayer.ovr}
                </Col>
                <Col>
                  <strong>Age:</strong> {selectedPlayer.age}
                </Col>
              </Row>

              <Row className="mb-3">
                <Col>
                  <strong>Current Team:</strong>{' '}
                  {teams.find(t => t.tid === selectedPlayer.tid)?.name || 'Free Agent'}
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Your Bid Amount</Form.Label>
                <Form.Control
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  min={getRecommendedBid(selectedPlayer) * 0.5}
                  step={50000}
                />
                <Form.Text className="text-muted">
                  Recommended: ${(getRecommendedBid(selectedPlayer) / 1000).toFixed(0)}K
                </Form.Text>
              </Form.Group>

              <Alert variant="warning">
                <strong>Note:</strong> If you win this bid, {selectedPlayer.name} will sign a contract
                at 2x the standard rookie salary. The original team will receive 10% of the salary
                plus your bid amount as compensation.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBidModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmitBid}>
            Submit Bid
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default OriginDraftView;
