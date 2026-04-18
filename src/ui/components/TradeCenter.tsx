import { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Badge,
  Form,
  InputGroup,
  Alert,
  Modal,
  ProgressBar,
  Row,
  Col,
  Card,
} from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import {
  calculatePlayerValue,
  calculatePickValue,
  evaluateTrade,
  createTradeAsset,
  proposeTrade,
  shouldAcceptTrade,
  executeTrade,
  isPlayerTradable,
  type TradeAsset,
  type TradeProposal,
} from '@worker/core/trade';
import type { Team, Player } from '@common/entities';
import type { DraftPick } from '../../worker/api/types';

interface TradeCenterProps {
  team: Team;
  players: Player[];
  onTradeComplete?: () => void;
}

interface SelectedAsset {
  type: 'player' | 'pick' | 'cash';
  data: Player | DraftPick | number;
  value: number;
}

function TradeCenter({ team, players, onTradeComplete }: TradeCenterProps) {
  const { teams, syncState } = useGameStore();
  const engine = getGameEngine();

  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [myAssets, setMyAssets] = useState<SelectedAsset[]>([]);
  const [theirAssets, setTheirAssets] = useState<SelectedAsset[]>([]);
  const [tradeResult, setTradeResult] = useState<{
    fair: boolean;
    fromValue: number;
    toValue: number;
    ratio: number;
  } | null>(null);
  const [aiResponse, setAiResponse] = useState<{
    accepted: boolean;
    reason: string;
  } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [cashOffer, setCashOffer] = useState<number>(0);

  // Get other teams in same region
  const otherTeams = useMemo(() => {
    return teams.filter(t => t.tid !== team.tid && t.region === team.region);
  }, [teams, team]);

  const selectedTeam = useMemo(() => {
    return otherTeams.find(t => t.tid === selectedTeamId) || null;
  }, [otherTeams, selectedTeamId]);

  // Get team players
  const myTeamPlayers = players;
  const theirTeamPlayers = useMemo(() => {
    if (!selectedTeam) return [];
    const allPlayers = engine.getPlayers();
    return allPlayers.filter(p => p.tid === selectedTeam.tid);
  }, [selectedTeam, engine]);

  // Get draft picks for both teams (only for First/Second Continent teams)
  const myPicks = useMemo(() => {
    if (team.region !== 'firstContinent' && team.region !== 'secondContinent') {
      return [] as DraftPick[];
    }
    return engine.getDraftPicks(team.tid);
  }, [team, engine]);

  const theirPicks = useMemo(() => {
    if (!selectedTeam) return [];
    if (selectedTeam.region !== 'firstContinent' && selectedTeam.region !== 'secondContinent') {
      return [] as DraftPick[];
    }
    return engine.getDraftPicks(selectedTeam.tid);
  }, [selectedTeam, engine]);

  // Add asset to trade
  const addAsset = (asset: SelectedAsset, isMyTeam: boolean) => {
    if (isMyTeam) {
      setMyAssets([...myAssets, asset]);
    } else {
      setTheirAssets([...theirAssets, asset]);
    }
    setTradeResult(null);
    setAiResponse(null);
  };

  // Remove asset from trade
  const removeAsset = (index: number, isMyTeam: boolean) => {
    if (isMyTeam) {
      setMyAssets(myAssets.filter((_, i) => i !== index));
    } else {
      setTheirAssets(theirAssets.filter((_, i) => i !== index));
    }
    setTradeResult(null);
    setAiResponse(null);
  };

  // Evaluate trade
  const handleEvaluateTrade = () => {
    if (!selectedTeam || myAssets.length === 0 || theirAssets.length === 0) {
      setTradeResult(null);
      return;
    }

    const proposal: TradeProposal = {
      fromTeam: team.tid,
      toTeam: selectedTeam.tid,
      fromAssets: myAssets.map(a => createTradeAsset(a.type, a.data)),
      toAssets: theirAssets.map(a => createTradeAsset(a.type, a.data)),
      status: 'pending',
    };

    const evaluation = evaluateTrade(proposal);
    const myTotalValue = myAssets.reduce((sum, a) => sum + a.value, 0);
    const theirTotalValue = theirAssets.reduce((sum, a) => sum + a.value, 0);

    setTradeResult({
      fair: evaluation.fair,
      fromValue: myTotalValue,
      toValue: theirTotalValue,
      ratio: Math.min(myTotalValue, theirTotalValue) / Math.max(myTotalValue, theirTotalValue),
    });
  };

  // Propose trade to AI
  const handleProposeTrade = () => {
    if (!selectedTeam || myAssets.length === 0 || theirAssets.length === 0) {
      return;
    }

    const proposal: TradeProposal = {
      fromTeam: team.tid,
      toTeam: selectedTeam.tid,
      fromAssets: myAssets.map(a => createTradeAsset(a.type, a.data)),
      toAssets: theirAssets.map(a => createTradeAsset(a.type, a.data)),
      status: 'pending',
    };

    const accepted = shouldAcceptTrade(proposal, true);

    setAiResponse({
      accepted,
      reason: accepted
        ? 'They accepted your trade offer!'
        : 'They rejected your trade offer. Try adjusting the deal.',
    });

    setShowConfirmModal(true);
  };

  // Execute trade
  const handleExecuteTrade = async () => {
    if (!selectedTeam || !aiResponse?.accepted) {
      setShowConfirmModal(false);
      return;
    }

    const proposal: TradeProposal = {
      fromTeam: team.tid,
      toTeam: selectedTeam.tid,
      fromAssets: myAssets.map(a => createTradeAsset(a.type, a.data)),
      toAssets: theirAssets.map(a => createTradeAsset(a.type, a.data)),
      status: 'accepted',
    };

    const allPlayers = engine.getPlayers();

    // Execute trade on players
    for (const asset of myAssets) {
      if (asset.type === 'player') {
        const player = asset.data as Player;
        const realPlayer = allPlayers.find(p => p.pid === player.pid);
        if (realPlayer) {
          realPlayer.tid = selectedTeam.tid;
        }
      }
    }

    for (const asset of theirAssets) {
      if (asset.type === 'player') {
        const player = asset.data as Player;
        const realPlayer = allPlayers.find(p => p.pid === player.pid);
        if (realPlayer) {
          realPlayer.tid = team.tid;
        }
      }
    }

    // Execute trade on draft picks
    for (const asset of myAssets) {
      if (asset.type === 'pick') {
        const pick = asset.data as DraftPick;
        engine.tradeDraftPick(pick.dpid, team.tid, selectedTeam.tid);
      }
    }

    for (const asset of theirAssets) {
      if (asset.type === 'pick') {
        const pick = asset.data as DraftPick;
        engine.tradeDraftPick(pick.dpid, selectedTeam.tid, team.tid);
      }
    }

    // Sync state and close
    syncState();
    setShowConfirmModal(false);
    setMyAssets([]);
    setTheirAssets([]);
    setTradeResult(null);
    setAiResponse(null);

    if (onTradeComplete) {
      onTradeComplete();
    }
  };

  // Format asset display
  const formatAsset = (asset: SelectedAsset): string => {
    switch (asset.type) {
      case 'player':
        const p = asset.data as Player;
        return `${p.name} (${p.pos}) - OVR: ${p.ovr}`;
      case 'pick':
        const pick = asset.data as DraftPick;
        return `R${pick.round} #${pick.pick} (${pick.season})`;
      case 'cash':
        return `$${(asset.data as number)}K`;
      default:
        return 'Unknown';
    }
  };

  // Get OVR class for display
  const getOvrClass = (ovr: number): string => {
    if (ovr >= 85) return 'ovr-elite';
    if (ovr >= 75) return 'ovr-strong';
    if (ovr >= 60) return 'ovr-average';
    return 'ovr-weak';
  };

  return (
    <div className="trade-center">
      <Row>
        {/* Team Selection */}
        <Col md={12} className="mb-3">
          <Card className="p-3">
            <h5 className="mb-3">Select Team to Trade With</h5>
            <Form.Select
              value={selectedTeamId || ''}
              onChange={(e) => {
                setSelectedTeamId(e.target.value ? Number(e.target.value) : null);
                setMyAssets([]);
                setTheirAssets([]);
                setTradeResult(null);
                setAiResponse(null);
              }}
            >
              <option value="">-- Select a team --</option>
              {otherTeams.map(t => (
                <option key={t.tid} value={t.tid}>
                  {t.name} (Budget: ${(t.budget / 1000).toFixed(0)}K)
                </option>
              ))}
            </Form.Select>
          </Card>
        </Col>

        {selectedTeam && (
          <>
            {/* Trade Proposal */}
            <Col md={6} className="mb-3">
              <Card className="p-3 h-100">
                <h5 className="mb-3">You Give ({myAssets.length} items)</h5>

                {/* My Player Selection */}
                <div className="mb-3">
                  <h6>Select Players</h6>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <Table size="sm">
                      <thead>
                        <tr>
                          <th>Pos</th>
                          <th>Name</th>
                          <th>OVR</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myTeamPlayers
                          .filter(p => isPlayerTradable(p))
                          .map(p => {
                            const isSelected = myAssets.some(
                              a => a.type === 'player' && (a.data as Player).pid === p.pid
                            );
                            return (
                              <tr key={p.pid}>
                                <td>{p.pos}</td>
                                <td>{p.name}</td>
                                <td>
                                  <span className={getOvrClass(p.ovr)}>{p.ovr}</span>
                                </td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant={isSelected ? 'danger' : 'outline-primary'}
                                    disabled={isSelected && !myAssets.some(
                                      a => a.type === 'player' && (a.data as Player).pid === p.pid
                                    )}
                                    onClick={() => {
                                      if (!isSelected) {
                                        addAsset(
                                          {
                                            type: 'player',
                                            data: p,
                                            value: calculatePlayerValue(p),
                                          },
                                          true
                                        );
                                      }
                                    }}
                                  >
                                    {isSelected ? 'Added' : 'Add'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </Table>
                  </div>
                </div>

                {/* My Draft Picks Selection */}
                {myPicks.length > 0 && (
                  <div className="mb-3">
                    <h6>Select Draft Picks</h6>
                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                      <Table size="sm">
                        <thead>
                          <tr>
                            <th>Round</th>
                            <th>Pick</th>
                            <th>Value</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myPicks.map(pick => {
                            const isSelected = myAssets.some(
                              a => a.type === 'pick' && (a.data as DraftPick).dpid === pick.dpid
                            );
                            const pickValue = calculatePickValue(pick);
                            return (
                              <tr key={pick.dpid}>
                                <td>
                                  <Badge bg={pick.round === 1 ? 'primary' : 'secondary'}>
                                    R{pick.round}
                                  </Badge>
                                </td>
                                <td>#{pick.pick}</td>
                                <td>{pickValue}</td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant={isSelected ? 'danger' : 'outline-primary'}
                                    onClick={() => {
                                      if (!isSelected) {
                                        addAsset(
                                          {
                                            type: 'pick',
                                            data: pick,
                                            value: pickValue,
                                          },
                                          true
                                        );
                                      } else {
                                        const idx = myAssets.findIndex(
                                          a => a.type === 'pick' && (a.data as DraftPick).dpid === pick.dpid
                                        );
                                        if (idx >= 0) removeAsset(idx, true);
                                      }
                                    }}
                                  >
                                    {isSelected ? 'Remove' : 'Add'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Selected Assets */}
                {myAssets.length > 0 && (
                  <div className="mt-3">
                    <h6>Selected Assets</h6>
                    {myAssets.map((asset, index) => (
                      <div
                        key={index}
                        className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded"
                      >
                        <span>{formatAsset(asset)}</span>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => removeAsset(index, true)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div className="mt-2 text-end">
                      <strong>Total Value: {myAssets.reduce((sum, a) => sum + a.value, 0)}</strong>
                    </div>
                  </div>
                )}
              </Card>
            </Col>

            <Col md={6} className="mb-3">
              <Card className="p-3 h-100">
                <h5 className="mb-3">You Receive ({theirAssets.length} items)</h5>

                {/* Their Player Selection */}
                <div className="mb-3">
                  <h6>Select Players</h6>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    <Table size="sm">
                      <thead>
                        <tr>
                          <th>Pos</th>
                          <th>Name</th>
                          <th>OVR</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {theirTeamPlayers
                          .filter(p => isPlayerTradable(p))
                          .map(p => {
                            const isSelected = theirAssets.some(
                              a => a.type === 'player' && (a.data as Player).pid === p.pid
                            );
                            return (
                              <tr key={p.pid}>
                                <td>{p.pos}</td>
                                <td>{p.name}</td>
                                <td>
                                  <span className={getOvrClass(p.ovr)}>{p.ovr}</span>
                                </td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant={isSelected ? 'danger' : 'outline-primary'}
                                    disabled={isSelected}
                                    onClick={() => {
                                      if (!isSelected) {
                                        addAsset(
                                          {
                                            type: 'player',
                                            data: p,
                                            value: calculatePlayerValue(p),
                                          },
                                          false
                                        );
                                      }
                                    }}
                                  >
                                    {isSelected ? 'Added' : 'Add'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </Table>
                  </div>
                </div>

                {/* Their Draft Picks Selection */}
                {theirPicks.length > 0 && (
                  <div className="mb-3">
                    <h6>Select Draft Picks</h6>
                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                      <Table size="sm">
                        <thead>
                          <tr>
                            <th>Round</th>
                            <th>Pick</th>
                            <th>Value</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {theirPicks.map(pick => {
                            const isSelected = theirAssets.some(
                              a => a.type === 'pick' && (a.data as DraftPick).dpid === pick.dpid
                            );
                            const pickValue = calculatePickValue(pick);
                            return (
                              <tr key={pick.dpid}>
                                <td>
                                  <Badge bg={pick.round === 1 ? 'primary' : 'secondary'}>
                                    R{pick.round}
                                  </Badge>
                                </td>
                                <td>#{pick.pick}</td>
                                <td>{pickValue}</td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant={isSelected ? 'danger' : 'outline-primary'}
                                    onClick={() => {
                                      if (!isSelected) {
                                        addAsset(
                                          {
                                            type: 'pick',
                                            data: pick,
                                            value: pickValue,
                                          },
                                          false
                                        );
                                      } else {
                                        const idx = theirAssets.findIndex(
                                          a => a.type === 'pick' && (a.data as DraftPick).dpid === pick.dpid
                                        );
                                        if (idx >= 0) removeAsset(idx, false);
                                      }
                                    }}
                                  >
                                    {isSelected ? 'Remove' : 'Add'}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Selected Assets */}
                {theirAssets.length > 0 && (
                  <div className="mt-3">
                    <h6>Selected Assets</h6>
                    {theirAssets.map((asset, index) => (
                      <div
                        key={index}
                        className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded"
                      >
                        <span>{formatAsset(asset)}</span>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => removeAsset(index, false)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div className="mt-2 text-end">
                      <strong>Total Value: {theirAssets.reduce((sum, a) => sum + a.value, 0)}</strong>
                    </div>
                  </div>
                )}
              </Card>
            </Col>

            {/* Trade Evaluation */}
            <Col md={12}>
              <Card className="p-3">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-2">Trade Evaluation</h5>
                    {tradeResult && (
                      <div>
                        <div className="mb-2">
                          You give: <strong>{tradeResult.fromValue}</strong> |
                          You receive: <strong>{tradeResult.toValue}</strong>
                        </div>
                        <ProgressBar
                          now={tradeResult.ratio * 100}
                          variant={tradeResult.fair ? 'success' : 'warning'}
                          className="mb-2"
                          label={`${(tradeResult.ratio * 100).toFixed(0)}% Fair`}
                        />
                        {tradeResult.fair ? (
                          <Alert variant="success" className="mb-0">
                            This trade is fair (85%+ match). The AI might accept.
                          </Alert>
                        ) : (
                          <Alert variant="warning" className="mb-0">
                            This trade is not fair. Adjust the assets to make it more balanced.
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    {myAssets.length > 0 && theirAssets.length > 0 && (
                      <>
                        <Button variant="outline-primary" onClick={handleEvaluateTrade}>
                          Evaluate Trade
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleProposeTrade}
                          disabled={!tradeResult?.fair}
                        >
                          Propose Trade
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Trade Response</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {aiResponse && (
            <Alert variant={aiResponse.accepted ? 'success' : 'danger'}>
              {aiResponse.reason}
            </Alert>
          )}

          {myAssets.length > 0 && (
            <div className="mb-3">
              <h6>You give:</h6>
              <ul className="mb-0">
                {myAssets.map((asset, i) => (
                  <li key={i}>{formatAsset(asset)}</li>
                ))}
              </ul>
            </div>
          )}

          {theirAssets.length > 0 && (
            <div className="mb-3">
              <h6>You receive:</h6>
              <ul className="mb-0">
                {theirAssets.map((asset, i) => (
                  <li key={i}>{formatAsset(asset)}</li>
                ))}
              </ul>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Close
          </Button>
          {aiResponse?.accepted && (
            <Button variant="success" onClick={handleExecuteTrade}>
              Confirm Trade
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default TradeCenter;
