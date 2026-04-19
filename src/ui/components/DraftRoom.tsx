import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Badge,
  Button,
  Card,
  Row,
  Col,
  Alert,
  ProgressBar,
  Modal,
  Form,
} from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import type { DraftProspectInternal as DraftProspect } from '../../worker/api/types';
import type { Team, Player } from '@common/entities';

interface DraftRoomProps {
  team: Team;
  onDraftComplete?: () => void;
}

function getOvrClass(ovr: number): string {
  if (ovr >= 85) return 'ovr-elite';
  if (ovr >= 75) return 'ovr-strong';
  if (ovr >= 60) return 'ovr-average';
  return 'ovr-weak';
}

function getRoundBadgeColor(round: number): string {
  if (round === 1) return 'danger';
  if (round === 2) return 'warning';
  if (round === 3) return 'info';
  return 'secondary';
}

interface DraftPick {
  round: number;
  pick: number;
  overall: number;
  teamTid: number;
  teamName: string;
  prospect?: DraftProspect;
}

interface DraftResult {
  prospect: DraftProspect;
  pick: DraftPick;
}

function DraftRoom({ team, onDraftComplete }: DraftRoomProps) {
  const { season, teams, players, syncState } = useGameStore();
  const engine = getGameEngine();

  const [draftPool, setDraftPool] = useState<DraftProspect[]>([]);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [draftResults, setDraftResults] = useState<DraftResult[]>([]);
  const [isOnClock, setIsOnClock] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<DraftProspect | null>(null);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [noDraft, setNoDraft] = useState(false);

  // Regions that have draft system
  const DRAFT_REGIONS = ['firstContinent', 'secondContinent'];

  // Calculate draft order (only for regions with draft)
  useEffect(() => {
    if (teams.length === 0) return;

    // Check if user's region has draft
    if (!DRAFT_REGIONS.includes(team.region)) {
      setNoDraft(true);
      return;
    }

    const order = engine.getRegionalDraftOrder(team.region);
    setDraftOrder(order);
  }, [teams, season, team.region, engine]);

  // Generate draft pool based on number of teams
  useEffect(() => {
    if (noDraft || draftOrder.length === 0) return;

    // Generate enough prospects: 7 rounds × teams × 1.1 (buffer)
    const numProspects = Math.ceil(draftOrder.length * 7 * 1.1);
    const pool = engine.generateDraftPool(numProspects);
    setDraftPool(pool);
    setShowDraftModal(true);
  }, [season, draftOrder.length, noDraft]);

  // Create draft picks
  const draftPicks = useMemo(() => {
    const picks: DraftPick[] = [];
    for (let round = 1; round <= 7; round++) {
      for (let i = 0; i < draftOrder.length; i++) {
        const teamTid = draftOrder[i];
        const teamData = teams.find(t => t.tid === teamTid);
        if (!teamData) continue;

        const pickNum = i + 1;
        const overallPickNum = (round - 1) * draftOrder.length + pickNum;

        // Check if this pick has been made
        const result = draftResults.find(
          r => r.pick.round === round && r.pick.pick === pickNum
        );

        picks.push({
          round,
          pick: pickNum,
          overall: overallPickNum,
          teamTid,
          teamName: teamData.name,
          prospect: result?.prospect,
        });
      }
    }
    return picks;
  }, [draftOrder, teams, draftResults]);

  // Get current pick
  const currentPick = useMemo(() => {
    return draftPicks.find(p => !p.prospect);
  }, [draftPicks]);

  // Check if it's user's turn
  useEffect(() => {
    if (currentPick && currentPick.teamTid === team.tid) {
      setIsOnClock(true);
    } else {
      setIsOnClock(false);
    }
  }, [currentPick, team]);

  // Get available prospects
  const availableProspects = useMemo(() => {
    const draftedPids = draftResults.map(r => r.prospect.pid);
    return draftPool.filter(p => !draftedPids.includes(p.pid));
  }, [draftPool, draftResults]);

  // Get my picks
  const myPicks = useMemo(() => {
    return draftPicks.filter(p => p.teamTid === team.tid);
  }, [draftPicks, team]);

  // Make draft pick
  const handleMakePick = (prospect: DraftProspect) => {
    if (!currentPick || currentPick.teamTid !== team.tid) return;

    const pick = {
      round: currentPick.round,
      pick: currentPick.pick,
      overall: currentPick.overall,
      teamTid: team.tid,
      teamName: team.name,
    };

    // Sign the player
    engine.selectDraftedPlayer(team.tid, prospect, pick);

    // Add to results
    setDraftResults([...draftResults, { prospect, pick }]);

    // Update player's team
    const player = players.find(p => p.pid === prospect.pid);
    if (player) {
      player.tid = team.tid;
      player.contract = {
        amount: prospect.contract?.amount || 5000,
        exp: season + (pick.round <= 2 ? 4 : 3),
        years: pick.round <= 2 ? 4 : 3,
        incentives: 0,
        signingBonus: prospect.contract?.signingBonus || 2500,
        guaranteed: prospect.contract?.guaranteed || 10000,
        noTrade: false,
      };
    }

    syncState();
    setSelectedProspect(null);
    setShowProspectModal(false);
  };

  // Sim AI pick
  const handleSimPick = () => {
    if (!currentPick || currentPick.teamTid === team.tid) return;

    // AI picks best available player
    const bestProspect = availableProspects[0];
    if (!bestProspect) return;

    const pick = {
      round: currentPick.round,
      pick: currentPick.pick,
      overall: currentPick.overall,
      teamTid: currentPick.teamTid,
      teamName: currentPick.teamName,
    };

    setDraftResults([...draftResults, { prospect: bestProspect, pick }]);
  };

  // Auto-sim to user's pick (batch update to avoid blocking)
  const handleSimToUser = () => {
    if (!currentPick || currentPick.teamTid === team.tid) return;

    // Find all picks until user's turn
    const picksToSim: DraftResult[] = [];
    const draftedPids = new Set(draftResults.map(r => r.prospect.pid));
    const remainingProspects = draftPool.filter(p => !draftedPids.has(p.pid));

    // Find upcoming picks until user's team
    const pendingPicks = draftPicks.filter(p => !p.prospect);
    const userPickIndex = pendingPicks.findIndex(p => p.teamTid === team.tid);

    if (userPickIndex === -1) return;

    // Simulate all picks before user's turn
    for (let i = 0; i < userPickIndex && remainingProspects.length > 0; i++) {
      const pick = pendingPicks[i];
      const bestProspect = remainingProspects.shift();

      if (bestProspect && pick) {
        picksToSim.push({
          prospect: bestProspect,
          pick: {
            round: pick.round,
            pick: pick.pick,
            overall: pick.overall,
            teamTid: pick.teamTid,
            teamName: pick.teamName,
          },
        });
      }
    }

    // Batch update all results at once
    if (picksToSim.length > 0) {
      setDraftResults([...draftResults, ...picksToSim]);
    }
  };

  // Complete draft
  const handleCompleteDraft = () => {
    const picksToSim: DraftResult[] = [];
    const draftedPids = new Set(draftResults.map(r => r.prospect.pid));
    const remainingProspects = draftPool.filter(p => !draftedPids.has(p.pid));

    // Get all remaining picks
    const pendingPicks = draftPicks.filter(p => !p.prospect);

    // Simulate all remaining picks
    for (let i = 0; i < pendingPicks.length && remainingProspects.length > 0; i++) {
      const pick = pendingPicks[i];
      const bestProspect = remainingProspects.shift();

      if (bestProspect && pick) {
        picksToSim.push({
          prospect: bestProspect,
          pick: {
            round: pick.round,
            pick: pick.pick,
            overall: pick.overall,
            teamTid: pick.teamTid,
            teamName: pick.teamName,
          },
        });
      }
    }

    // Batch update all results at once
    if (picksToSim.length > 0) {
      setDraftResults([...draftResults, ...picksToSim]);
    }

    if (onDraftComplete) {
      onDraftComplete();
    }
  };

  const formatMoney = (amount: number) => {
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  // No draft for this region
  if (noDraft) {
    return (
      <div className="draft-room">
        <Card className="p-4">
          <Alert variant="warning">
            <h5>No Draft System</h5>
            <p className="mb-0">
              {team.region === 'originContinent'
                ? '起源大陆使用转会制度和"起源选秀"系统，没有常规选秀。'
                : team.region === 'miningIsland'
                ? '矿业岛使用转会制度和升降级系统，没有选秀。'
                : '该地区没有选秀系统。'}
            </p>
          </Alert>
        </Card>
      </div>
    );
  }

  return (
    <div className="draft-room">
      {/* Draft Start Modal */}
      <Modal show={showDraftModal} onHide={() => setShowDraftModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Draft Room - Season {season}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            Welcome to the {season} Draft! You have {myPicks.length} picks this year.
          </Alert>
          <p>The draft pool has been generated with {draftPool.length} prospects.</p>
          <p>Your first pick is at position {myPicks[0]?.pick || 'N/A'} in Round {myPicks[0]?.round || 'N/A'}.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowDraftModal(false)}>
            Enter Draft Room
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Draft Status */}
      <Card className="p-4 mb-3">
        <Row className="align-items-center">
          <Col md={4}>
            <h5 className="mb-1">Round {currentPick?.round || 7}</h5>
            <small className="text-muted">of 7</small>
          </Col>
          <Col md={4}>
            <h5 className="mb-1">Pick {currentPick?.pick || '-'} / {draftOrder.length}</h5>
            <small className="text-muted">Overall: {currentPick?.overall || '-'}</small>
          </Col>
          <Col md={4}>
            {isOnClock ? (
              <Badge bg="success" className="fs-6">On the Clock!</Badge>
            ) : currentPick ? (
              <span>Picking: <strong>{currentPick.teamName}</strong></span>
            ) : (
              <Badge bg="secondary">Draft Complete</Badge>
            )}
          </Col>
        </Row>
      </Card>

      {/* Action Buttons */}
      {!isOnClock && currentPick && (
        <Card className="p-3 mb-3">
          <div className="d-flex gap-2">
            <Button variant="outline-primary" onClick={handleSimPick}>
              Sim This Pick
            </Button>
            <Button variant="primary" onClick={handleSimToUser}>
              Sim to Your Pick
            </Button>
          </div>
        </Card>
      )}

      {isOnClock && (
        <Alert variant="success" className="mb-3">
          <h5>🎯 You're on the clock!</h5>
          <p className="mb-0">Select a prospect from the board below to make your pick.</p>
        </Alert>
      )}

      {/* Draft Board */}
      <Row>
        <Col md={8}>
          <Card className="p-4">
            <h5 className="mb-3">Draft Board ({availableProspects.length} available)</h5>

            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              <Table hover responsive size="sm">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Pos</th>
                    <th>Name</th>
                    <th>OVR</th>
                    <th>POT</th>
                    <th>Age</th>
                    <th>Projected</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {availableProspects.slice(0, 100).map((prospect, index) => (
                    <tr key={`prospect-${index}-${prospect.name}`}>
                      <td>{index + 1}</td>
                      <td>{prospect.pos}</td>
                      <td>{prospect.name}</td>
                      <td>
                        <span className={getOvrClass(prospect.ovr)}>
                          <strong>{prospect.ovr}</strong>
                        </span>
                      </td>
                      <td>{prospect.pot}</td>
                      <td>{prospect.age}</td>
                      <td>
                        <Badge bg={getRoundBadgeColor(prospect.projectedRound)}>
                          Rd {prospect.projectedRound}
                        </Badge>
                      </td>
                      <td>
                        {isOnClock ? (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setSelectedProspect(prospect);
                              setShowProspectModal(true);
                            }}
                          >
                            Draft
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline-secondary" disabled>
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>

        <Col md={4}>
          {/* My Picks */}
          <Card className="p-4 mb-3">
            <h5 className="mb-3">My Picks</h5>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {myPicks.map((pick, index) => {
                const result = draftResults.find(
                  r => r.pick.round === pick.round && r.pick.pick === pick.pick
                );

                return (
                  <div
                    key={index}
                    className={`d-flex justify-content-between align-items-center p-2 mb-2 rounded ${
                      result ? 'bg-success bg-opacity-10' : 'bg-light'
                    }`}
                  >
                    <div>
                      <Badge bg={getRoundBadgeColor(pick.round)} className="me-2">
                        Rd {pick.round}
                      </Badge>
                      <span>#{pick.pick}</span>
                    </div>
                    <div>
                      {result ? (
                        <strong className="text-success">{result.prospect.name}</strong>
                      ) : (
                        <span className="text-muted">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent Picks */}
          <Card className="p-4">
            <h5 className="mb-3">Recent Picks</h5>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {draftResults.slice(-10).reverse().map((result, index) => (
                <div key={index} className="p-2 mb-2 bg-light rounded">
                  <div className="d-flex justify-content-between">
                    <span>
                      <Badge bg={getRoundBadgeColor(result.pick.round)} className="me-2">
                        Rd {result.pick.round}
                      </Badge>
                      #{result.pick.pick}
                    </span>
                    <span className="text-muted">{result.pick.teamName}</span>
                  </div>
                  <div className="mt-1">
                    <strong>{result.prospect.name}</strong> ({result.prospect.pos}) - OVR: {result.prospect.ovr}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Prospect Modal */}
      <Modal show={showProspectModal} onHide={() => setShowProspectModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Draft Prospect - {selectedProspect?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedProspect && (
            <div>
              {/* Overall Rating */}
              <Card className="p-3 mb-3 text-center">
                <div className={`stat-value ${getOvrClass(selectedProspect.ovr)}`} style={{ fontSize: '3rem' }}>
                  {selectedProspect.ovr}
                </div>
                <h5>{selectedProspect.name}</h5>
                <p className="text-muted mb-0">
                  {selectedProspect.pos} | Age: {selectedProspect.age} | Pot: {selectedProspect.pot}
                </p>
              </Card>

              {/* Attributes */}
              <Row className="mb-3">
                <Col md={6}>
                  <Card className="p-3">
                    <h6>Physical</h6>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Height:</span>
                      <strong>{selectedProspect.hgt}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Strength:</span>
                      <strong>{selectedProspect.stre}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Speed:</span>
                      <strong>{selectedProspect.spd}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Endurance:</span>
                      <strong>{selectedProspect.endu}</strong>
                    </div>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="p-3">
                    <h6>Combine Results</h6>
                    <div className="d-flex justify-content-between mb-1">
                      <span>40 Yard:</span>
                      <strong>{selectedProspect.combineResults?.fortyTime?.toFixed(2)}s</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Bench Press:</span>
                      <strong>{selectedProspect.combineResults?.benchPress || '-'}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1">
                      <span>Vertical:</span>
                      <strong>{selectedProspect.combineResults?.verticalJump?.toFixed(1)}"</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Broad Jump:</span>
                      <strong>{selectedProspect.combineResults?.broadJump?.toFixed(0)}"</strong>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* Contract Info */}
              <Card className="p-3">
                <h6>Projected Contract</h6>
                {selectedProspect.contract && (
                  <div>
                    <p className="mb-1">
                      Annual Salary: <strong>{formatMoney(selectedProspect.contract.amount)}</strong>
                    </p>
                    <p className="mb-1">
                      Length: <strong>{selectedProspect.contract.years} years</strong>
                    </p>
                    <p className="mb-0">
                      Signing Bonus: <strong>{formatMoney(selectedProspect.contract.signingBonus)}</strong>
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProspectModal(false)}>
            Cancel
          </Button>
          {selectedProspect && isOnClock && (
            <Button
              variant="success"
              onClick={() => handleMakePick(selectedProspect)}
            >
              Draft {selectedProspect.name}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default DraftRoom;
