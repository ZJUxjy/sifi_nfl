import { useState } from 'react';
import { Row, Col, Nav, Tab, Badge, Button, ButtonGroup } from 'react-bootstrap';
import { useGameStore, useUserTeam } from '../stores/gameStore';
import RosterView from '../components/RosterView';
import StandingsView from '../components/StandingsView';
import ScheduleView from '../components/ScheduleView';
import FinancesView from '../components/FinancesView';
import TradeCenter from '../components/TradeCenter';
import FreeAgencyView from '../components/FreeAgencyView';
import DraftRoom from '../components/DraftRoom';
import ImperialCupView from '../components/ImperialCupView';
import SaveLoadModal from '../components/SaveLoadModal';

interface GameScreenProps {
  onBack: () => void;
}

type TabKey = 'roster' | 'schedule' | 'standings' | 'finances' | 'trade' | 'freeAgency' | 'draft' | 'imperialCup';

function GameScreen({ onBack }: GameScreenProps) {
  const { season, week, players } = useGameStore();
  const currentTeam = useUserTeam();
  const [activeTab, setActiveTab] = useState<TabKey>('roster');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);

  if (!currentTeam) {
    return <div>No team selected</div>;
  }

  const teamPlayers = players.filter((p) => p.tid === currentTeam.tid);

  return (
    <div className="game-screen">
      {/* Team Header */}
      <div className="game-card p-4 mb-4">
        <Row className="align-items-center">
          <Col>
            <h2 className="mb-1" style={{ color: '#00d4ff' }}>{currentTeam.name}</h2>
            <div className="d-flex gap-3 text-muted">
              <span>Season {season}</span>
              <span>|</span>
              <span>Week {week}</span>
            </div>
          </Col>
          <Col xs="auto">
            <div className="d-flex align-items-center gap-3">
              <ButtonGroup size="sm">
                <Button variant="outline-primary" onClick={() => setShowSaveModal(true)}>
                  💾 Save
                </Button>
                <Button variant="outline-secondary" onClick={() => setShowLoadModal(true)}>
                  📂 Load
                </Button>
              </ButtonGroup>
              <div className="text-end ms-3">
                <div className="stat-value">${(currentTeam.budget / 1000).toFixed(0)}K</div>
                <small className="text-muted">Budget</small>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Main Content Tabs */}
      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k as TabKey)}>
        <Row>
          <Col md={2}>
            <Nav variant="pills" className="flex-column">
              <Nav.Item>
                <Nav.Link eventKey="roster" className="d-flex justify-content-between align-items-center">
                  🏈 Roster
                  <Badge bg="secondary">{teamPlayers.length}</Badge>
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="schedule">📅 Schedule</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="standings">🏆 Standings</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="finances">💰 Finances</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="freeAgency">👤 Free Agency</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="trade">🔄 Trade</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="draft">🎯 Draft</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="imperialCup">🏆 Imperial Cup</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
          <Col md={10}>
            <Tab.Content>
              <Tab.Pane eventKey="roster">
                <RosterView team={currentTeam} players={teamPlayers} />
              </Tab.Pane>
              <Tab.Pane eventKey="schedule">
                <ScheduleView team={currentTeam} />
              </Tab.Pane>
              <Tab.Pane eventKey="standings">
                <StandingsView team={currentTeam} />
              </Tab.Pane>
              <Tab.Pane eventKey="finances">
                <FinancesView team={currentTeam} players={teamPlayers} />
              </Tab.Pane>
              <Tab.Pane eventKey="freeAgency">
                <FreeAgencyView team={currentTeam} />
              </Tab.Pane>
              <Tab.Pane eventKey="trade">
                <TradeCenter team={currentTeam} players={teamPlayers} />
              </Tab.Pane>
              <Tab.Pane eventKey="draft">
                <DraftRoom team={currentTeam} />
              </Tab.Pane>
              <Tab.Pane eventKey="imperialCup">
                <ImperialCupView team={currentTeam} />
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>

      {/* Save/Load Modals */}
      <SaveLoadModal
        show={showSaveModal}
        onHide={() => setShowSaveModal(false)}
        mode="save"
      />
      <SaveLoadModal
        show={showLoadModal}
        onHide={() => setShowLoadModal(false)}
        mode="load"
      />
    </div>
  );
}

export default GameScreen;
