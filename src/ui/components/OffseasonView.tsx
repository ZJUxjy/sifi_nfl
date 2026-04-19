import { useState } from 'react';
import {
  Card,
  Button,
  Alert,
  Table,
  Badge,
  Modal,
  ProgressBar,
  Row,
  Col,
  Accordion,
} from 'react-bootstrap';
import { useSeason, useTeams, useSyncState } from '../stores/selectors';
import { getGameEngine } from '../../worker/api';
import type { OffseasonResult, OffseasonEvent } from '../../worker/api/types';

interface OffseasonViewProps {
  onSeasonAdvanced?: () => void;
}

function OffseasonView({ onSeasonAdvanced }: OffseasonViewProps) {
  const season = useSeason();
  const teams = useTeams();
  const syncState = useSyncState();
  const engine = getGameEngine();

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OffseasonResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvance = engine.isSeasonComplete();

  const handleAdvanceSeason = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await engine.advanceSeason();

      if (response.success && response.result) {
        setResult(response.result);
        setShowResultModal(true);
        syncState();

        if (onSeasonAdvanced) {
          onSeasonAdvanced();
        }
      } else {
        setError(response.error || 'Failed to advance season');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getEventIcon = (type: OffseasonEvent['type']): string => {
    switch (type) {
      case 'retirement':
        return '👋';
      case 'contractExpired':
        return '📄';
      case 'signed':
        return '✍️';
      case 'released':
        return '🚪';
      case 'drafted':
        return '🎯';
      case 'promoted':
        return '⬆️';
      case 'relegated':
        return '⬇️';
      default:
        return '📋';
    }
  };

  const getEventBadgeVariant = (type: OffseasonEvent['type']): string => {
    switch (type) {
      case 'retirement':
        return 'secondary';
      case 'contractExpired':
        return 'warning';
      case 'signed':
        return 'success';
      case 'released':
        return 'danger';
      case 'drafted':
        return 'primary';
      case 'promoted':
        return 'success';
      case 'relegated':
        return 'danger';
      default:
        return 'info';
    }
  };

  // Group events by type
  const groupedEvents = result?.events.reduce((acc, event) => {
    if (!acc[event.type]) acc[event.type] = [];
    acc[event.type].push(event);
    return acc;
  }, {} as Record<string, OffseasonEvent[]>) || {};

  // Get pending free agents
  const pendingFreeAgents = engine.getPendingFreeAgents();

  return (
    <div className="offseason-view">
      <Card className="mb-4">
        <Card.Header>
          <h4>Season Transition</h4>
        </Card.Header>
        <Card.Body>
          {!canAdvance ? (
            <Alert variant="info">
              <h5>Season In Progress</h5>
              <p className="mb-0">
                Complete the current season (all 17 weeks + playoffs) before advancing.
              </p>
            </Alert>
          ) : (
            <>
              <Alert variant="success">
                <h5>Season {season} Complete</h5>
                <p className="mb-0">Ready to advance to Season {season + 1}</p>
              </Alert>

              {/* Pending Free Agents Warning */}
              {pendingFreeAgents.length > 0 && (
                <Alert variant="warning" className="mb-3">
                  <strong>{pendingFreeAgents.length}</strong> players have expiring contracts.
                </Alert>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={handleAdvanceSeason}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Processing Offseason...
                  </>
                ) : (
                  <>Advance to Season {season + 1}</>
                )}
              </Button>

              {error && (
                <Alert variant="danger" className="mt-3">
                  {error}
                </Alert>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* What happens during offseason */}
      <Card className="mb-4">
        <Card.Header>
          <h5>Offseason Events</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>Player Changes</h6>
              <ul>
                <li>All players age one year</li>
                <li>Player skills develop or decline based on age</li>
                <li>Older players may retire</li>
                <li>Contracts expire, players become free agents</li>
              </ul>
            </Col>
            <Col md={6}>
              <h6>Team Changes</h6>
              <ul>
                <li>Draft (7 rounds, First/Second Continent)</li>
                <li>AI teams sign free agents</li>
                <li>Promotion/Relegation (Mining Island, Origin Continent)</li>
                <li>Rosters trimmed to 53 players</li>
              </ul>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Pending Free Agents List */}
      {pendingFreeAgents.length > 0 && canAdvance && (
        <Card className="mb-4">
          <Card.Header>
            <h5>Pending Free Agents ({pendingFreeAgents.length})</h5>
          </Card.Header>
          <Card.Body className="p-0">
            <Table striped size="sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Age</th>
                  <th>OVR</th>
                  <th>Team</th>
                  <th>Contract</th>
                </tr>
              </thead>
              <tbody>
                {pendingFreeAgents.slice(0, 20).map(player => {
                  const team = teams.find(t => t.tid === player.tid);
                  return (
                    <tr key={player.pid}>
                      <td>{player.name}</td>
                      <td>
                        <Badge bg="secondary">{player.pos}</Badge>
                      </td>
                      <td>{player.age}</td>
                      <td>
                        <Badge bg={player.ovr >= 80 ? 'success' : player.ovr >= 70 ? 'primary' : 'secondary'}>
                          {player.ovr}
                        </Badge>
                      </td>
                      <td>{team?.abbrev || 'FA'}</td>
                      <td>
                        ${(((player.contract?.amount || 0) / 1000)).toFixed(0)}K × {player.contract?.years || 0}yr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {pendingFreeAgents.length > 20 && (
              <div className="text-center p-2 text-muted">
                +{pendingFreeAgents.length - 20} more players
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Result Modal */}
      <Modal
        show={showResultModal}
        onHide={() => setShowResultModal(false)}
        size="lg"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>Season {result?.newSeason} Offseason Complete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {result && (
            <>
              {/* Summary Stats */}
              <Row className="mb-4 text-center">
                <Col md={3}>
                  <div className="border rounded p-3">
                    <h4 className="text-secondary">{result.retiredPlayers.length}</h4>
                    <small>Retired</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border rounded p-3">
                    <h4 className="text-warning">{result.newFreeAgents.length}</h4>
                    <small>Free Agents</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border rounded p-3">
                    <h4 className="text-primary">{result.draftedPlayers.length}</h4>
                    <small>Drafted</small>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="border rounded p-3">
                    <h4 className="text-success">{result.hallOfFameInductees.length}</h4>
                    <small>Hall of Fame</small>
                  </div>
                </Col>
              </Row>

              {/* Events by Category */}
              <Accordion>
                {/* Retirements */}
                {groupedEvents.retirement && groupedEvents.retirement.length > 0 && (
                  <Accordion.Item eventKey="retirement">
                    <Accordion.Header>
                      👋 Retirements ({groupedEvents.retirement.length})
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table size="sm">
                        <tbody>
                          {groupedEvents.retirement.map((event, idx) => (
                            <tr key={idx}>
                              <td>{event.playerName}</td>
                              <td className="text-muted">{event.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Accordion.Body>
                  </Accordion.Item>
                )}

                {/* Draft Picks */}
                {groupedEvents.drafted && groupedEvents.drafted.length > 0 && (
                  <Accordion.Item eventKey="drafted">
                    <Accordion.Header>
                      🎯 Draft Picks ({groupedEvents.drafted.length})
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table size="sm">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Team</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedEvents.drafted.slice(0, 50).map((event, idx) => (
                            <tr key={idx}>
                              <td>{event.playerName}</td>
                              <td>{event.teamName}</td>
                              <td>{event.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      {groupedEvents.drafted.length > 50 && (
                        <div className="text-muted text-center">
                          +{groupedEvents.drafted.length - 50} more picks
                        </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                )}

                {/* Signings */}
                {groupedEvents.signed && groupedEvents.signed.length > 0 && (
                  <Accordion.Item eventKey="signed">
                    <Accordion.Header>
                      ✍️ Signings ({groupedEvents.signed.length})
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table size="sm">
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Team</th>
                            <th>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedEvents.signed.slice(0, 50).map((event, idx) => (
                            <tr key={idx}>
                              <td>{event.playerName}</td>
                              <td>{event.teamName}</td>
                              <td>{event.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      {groupedEvents.signed.length > 50 && (
                        <div className="text-muted text-center">
                          +{groupedEvents.signed.length - 50} more signings
                        </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                )}

                {/* Released */}
                {groupedEvents.released && groupedEvents.released.length > 0 && (
                  <Accordion.Item eventKey="released">
                    <Accordion.Header>
                      🚪 Released ({groupedEvents.released.length})
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table size="sm">
                        <tbody>
                          {groupedEvents.released.slice(0, 30).map((event, idx) => (
                            <tr key={idx}>
                              <td>{event.playerName}</td>
                              <td>{event.teamName}</td>
                              <td className="text-muted">{event.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Accordion.Body>
                  </Accordion.Item>
                )}

                {/* Promotions/Relegations */}
                {(groupedEvents.promoted || groupedEvents.relegated) && (
                  <Accordion.Item eventKey="promo-releg">
                    <Accordion.Header>
                      ⬆️⬇️ Promotion/Relegation
                    </Accordion.Header>
                    <Accordion.Body>
                      {groupedEvents.promoted && groupedEvents.promoted.length > 0 && (
                        <>
                          <h6 className="text-success">Promoted</h6>
                          <ul>
                            {groupedEvents.promoted.map((event, idx) => (
                              <li key={idx}>
                                {event.teamName} - {event.details}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {groupedEvents.relegated && groupedEvents.relegated.length > 0 && (
                        <>
                          <h6 className="text-danger">Relegated</h6>
                          <ul>
                            {groupedEvents.relegated.map((event, idx) => (
                              <li key={idx}>
                                {event.teamName} - {event.details}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                )}

                {/* Hall of Fame */}
                {result.hallOfFameInductees.length > 0 && (
                  <Accordion.Item eventKey="hof">
                    <Accordion.Header>
                      🏆 Hall of Fame ({result.hallOfFameInductees.length})
                    </Accordion.Header>
                    <Accordion.Body>
                      <Table size="sm">
                        <tbody>
                          {result.hallOfFameInductees.map((player) => (
                            <tr key={player.pid}>
                              <td>{player.name}</td>
                              <td><Badge bg="secondary">{player.pos}</Badge></td>
                              <td>Peak OVR: {player.ovr}</td>
                              <td>Career: {player.retiredYear! - (player.draft?.year || player.retiredYear!)} seasons</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Accordion.Body>
                  </Accordion.Item>
                )}
              </Accordion>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowResultModal(false)}>
            Start Season {result?.newSeason}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default OffseasonView;
