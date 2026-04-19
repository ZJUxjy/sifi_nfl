import { useState, useMemo } from 'react';
import {
  Table,
  Button,
  Badge,
  Form,
  InputGroup,
  Modal,
  Row,
  Col,
  Card,
  Alert,
} from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import type { FreeAgentDemand } from '../../worker/api/types';
import type { Team, Player } from '@common/entities';

interface FreeAgencyViewProps {
  team: Team;
  onSigningComplete?: () => void;
}

function getOvrClass(ovr: number): string {
  if (ovr >= 85) return 'ovr-elite';
  if (ovr >= 75) return 'ovr-strong';
  if (ovr >= 60) return 'ovr-average';
  return 'ovr-weak';
}

function getPositionGroup(pos: string): string {
  const offense = ['QB', 'RB', 'WR', 'TE', 'OL'];
  const defense = ['DL', 'LB', 'CB', 'S'];
  const special = ['K', 'P'];

  if (offense.includes(pos)) return 'offense';
  if (defense.includes(pos)) return 'defense';
  if (special.includes(pos)) return 'special';
  return 'special';
}

function FreeAgencyView({ team, onSigningComplete }: FreeAgencyViewProps) {
  const { season, syncState } = useGameStore();
  const engine = getGameEngine();

  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof Player>('ovr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerSalary, setOfferSalary] = useState<number>(0);
  const [offerYears, setOfferYears] = useState<number>(1);
  const [contractDemand, setContractDemand] = useState<FreeAgentDemand | null>(null);
  const [offerResult, setOfferResult] = useState<{ accepted: boolean; reason: string } | null>(null);

  // Get free agents
  const freeAgents = useMemo(() => {
    return engine.getFreeAgents();
  }, [engine]);

  // Get current payroll
  const currentPayroll = useMemo(() => {
    const players = engine.getPlayers({ tid: team.tid });
    return players.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  }, [engine, team]);

  const capSpace = team.budget - currentPayroll;

  // Filter and sort free agents
  const filteredAgents = useMemo(() => {
    let result = [...freeAgents];

    // Position filter
    if (positionFilter !== 'all') {
      result = result.filter(p => p.pos === positionFilter);
    }

    // Search filter
    if (search) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortDir === 'desc' ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal);
    });

    return result;
  }, [freeAgents, positionFilter, search, sortBy, sortDir]);

  const handleSort = (field: keyof Player) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const handleMakeOffer = (player: Player) => {
    setSelectedPlayer(player);
    const demand = engine.getFreeAgentDemand(player);
    setContractDemand(demand);
    setOfferSalary(demand.minSalary);
    setOfferYears(demand.minYears);
    setOfferResult(null);
    setShowOfferModal(true);
  };

  const handleSubmitOffer = () => {
    if (!selectedPlayer || !contractDemand) return;

    const result = engine.evaluateFreeAgentOffer(
      selectedPlayer,
      contractDemand,
      {
        salary: offerSalary,
        years: offerYears,
        team,
      }
    );

    setOfferResult(result);

    if (result.accepted) {
      engine.commitFreeAgentSigning(selectedPlayer, team, offerSalary, offerYears);

      syncState();
      setShowOfferModal(false);
      setSelectedPlayer(null);
      setContractDemand(null);
      setOfferResult(null);

      if (onSigningComplete) {
        onSigningComplete();
      }
    }
  };

  const formatMoney = (amount: number) => {
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  return (
    <div className="free-agency-view">
      {/* Budget Status */}
      <Card className="p-3 mb-3">
        <Row className="text-center">
          <Col md={4}>
            <div className="stat-value">{formatMoney(team.budget)}</div>
            <small className="text-muted">Budget</small>
          </Col>
          <Col md={4}>
            <div className="stat-value">{formatMoney(currentPayroll)}</div>
            <small className="text-muted">Current Payroll</small>
          </Col>
          <Col md={4}>
            <div className="stat-value" style={{ color: capSpace > 0 ? '#22c55e' : '#ef4444' }}>
              {formatMoney(capSpace)}
            </div>
            <small className="text-muted">Cap Space</small>
          </Col>
        </Row>
      </Card>

      {/* Free Agent List */}
      <Card className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="mb-0">Free Agents ({filteredAgents.length})</h5>

          <div className="d-flex gap-3">
            <InputGroup style={{ width: 200 }}>
              <Form.Control
                placeholder="Search player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>

            <Form.Select
              style={{ width: 120 }}
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
            >
              <option value="all">All Pos</option>
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
          </div>
        </div>

        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
          <Table hover responsive>
            <thead>
              <tr>
                <th onClick={() => handleSort('pos')} style={{ cursor: 'pointer' }}>Pos</th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>Name</th>
                <th onClick={() => handleSort('age')} style={{ cursor: 'pointer' }}>Age</th>
                <th onClick={() => handleSort('ovr')} style={{ cursor: 'pointer' }}>OVR</th>
                <th onClick={() => handleSort('pot')} style={{ cursor: 'pointer' }}>POT</th>
                <th>Asking</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((player) => {
                const demand = engine.getFreeAgentDemand(player);
                const canAfford = capSpace >= demand.minSalary;

                return (
                  <tr key={player.pid}>
                    <td>
                      <span className={`pos-badge pos-${getPositionGroup(player.pos)}`}>
                        {player.pos}
                      </span>
                    </td>
                    <td>{player.name}</td>
                    <td>{player.age}</td>
                    <td>
                      <span className={getOvrClass(player.ovr)}>
                        <strong>{player.ovr}</strong>
                      </span>
                    </td>
                    <td>{player.pot}</td>
                    <td>
                      <small>
                        {formatMoney(demand.minSalary)}/{demand.minYears}yr
                      </small>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant={canAfford ? 'primary' : 'outline-secondary'}
                        disabled={!canAfford}
                        onClick={() => handleMakeOffer(player)}
                      >
                        {canAfford ? 'Make Offer' : 'No Cap Space'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-5 text-muted">
            <p>No free agents match your filters.</p>
          </div>
        )}
      </Card>

      {/* Contract Offer Modal */}
      <Modal show={showOfferModal} onHide={() => setShowOfferModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Contract Offer - {selectedPlayer?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedPlayer && contractDemand && (
            <div>
              {/* Player Info */}
              <div className="game-card p-3 mb-3">
                <Row>
                  <Col md={3}>
                    <div className="text-center">
                      <div className={`stat-value ${getOvrClass(selectedPlayer.ovr)}`}>
                        {selectedPlayer.ovr}
                      </div>
                      <small className="text-muted">OVR</small>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="stat-value">{selectedPlayer.pot}</div>
                      <small className="text-muted">POT</small>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="stat-value">{selectedPlayer.age}</div>
                      <small className="text-muted">Age</small>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="text-center">
                      <div className="stat-value">{selectedPlayer.pos}</div>
                      <small className="text-muted">Position</small>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Demands */}
              <Alert variant="info">
                <h6 className="mb-2">Player's Demands:</h6>
                <p className="mb-0">
                  Minimum Salary: <strong>{formatMoney(contractDemand.minSalary)}</strong> |
                  Minimum Years: <strong>{contractDemand.minYears}</strong>
                </p>
              </Alert>

              {/* Offer Form */}
              <div className="game-card p-3 mb-3">
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Annual Salary (in thousands)</Form.Label>
                      <Form.Control
                        type="number"
                        min={contractDemand.minSalary * 0.7}
                        max={team.budget}
                        step={5}
                        value={offerSalary}
                        onChange={(e) => setOfferSalary(Number(e.target.value))}
                      />
                      <Form.Text className="text-muted">
                        Demands: {formatMoney(contractDemand.minSalary)} -
                        {formatMoney(contractDemand.minSalary * 1.3)}
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Contract Length (years)</Form.Label>
                      <Form.Control
                        type="number"
                        min={1}
                        max={5}
                        value={offerYears}
                        onChange={(e) => setOfferYears(Number(e.target.value))}
                      />
                      <Form.Text className="text-muted">
                        Demands: {contractDemand.minYears} - {contractDemand.minYears + 2} years
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={12}>
                    <div className="d-flex justify-content-between">
                      <span>Total Contract Value:</span>
                      <strong>{formatMoney(offerSalary * offerYears)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Annual Cap Hit:</span>
                      <strong>{formatMoney(offerSalary)}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span>Cap Space After:</span>
                      <strong style={{ color: capSpace - offerSalary > 0 ? '#22c55e' : '#ef4444' }}>
                        {formatMoney(capSpace - offerSalary)}
                      </strong>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Offer Result */}
              {offerResult && (
                <Alert variant={offerResult.accepted ? 'success' : 'warning'}>
                  {offerResult.reason}
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowOfferModal(false)}>
            Cancel
          </Button>
          {!offerResult?.accepted && (
            <Button
              variant="primary"
              onClick={handleSubmitOffer}
              disabled={
                !contractDemand ||
                offerSalary < contractDemand.minSalary * 0.7 ||
                offerYears < contractDemand.minYears
              }
            >
              Submit Offer
            </Button>
          )}
          {offerResult?.accepted && (
            <Button variant="success" onClick={() => setShowOfferModal(false)}>
              Done
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default FreeAgencyView;
