import { useState, useMemo } from 'react';
import { Card, Table, Button, Badge, Tabs, Tab, Alert, Row, Col } from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import type { Team } from '@common/entities';
import type { PlayoffBracket, PlayoffMatchup } from '../../worker/api/types';

interface PlayoffsViewProps {
  // No props needed - uses global state
}

type RegionKey = 'firstContinent' | 'secondContinent' | 'originContinent' | 'miningIsland';

function PlayoffsView({}: PlayoffsViewProps) {
  const { season, teams, phase } = useGameStore();
  const engine = getGameEngine();
  const [activeRegion, setActiveRegion] = useState<RegionKey>('firstContinent');
  const [brackets, setBrackets] = useState<Map<RegionKey, PlayoffBracket>>(new Map());

  // Check if we're in playoff phase
  const isInPlayoffs = phase >= 3;

  // Get teams by region sorted by standings
  const regionTeams = useMemo(() => {
    const result: Map<RegionKey, Team[]> = new Map();
    const standings = engine.getStandings();

    for (const region of ['firstContinent', 'secondContinent', 'originContinent'] as RegionKey[]) {
      const regionStandings = standings
        .filter(s => s.region === region)
        .sort((a, b) => b.winPct - a.winPct);

      const teamsInRegion = regionStandings
        .map(s => teams.find(t => t.tid === s.tid))
        .filter((t): t is Team => t !== undefined);

      result.set(region, teamsInRegion);
    }

    return result;
  }, [teams, engine]);

  // Initialize brackets when playoffs start
  const initializePlayoffs = (region: RegionKey) => {
    const teams = regionTeams.get(region) || [];

    if (teams.length === 0) return;

    let bracket: PlayoffBracket;

    if (region === 'originContinent') {
      // Origin uses double elimination (but we'll display as single for simplicity)
      bracket = engine.generateSingleEliminationBracket(teams.slice(0, 8), region);
    } else {
      // First/Second Continent use single elimination with byes
      bracket = engine.generateSingleEliminationBracket(teams, region);
    }

    setBrackets(prev => new Map(prev).set(region, bracket));
  };

  // Get current bracket for active region
  const currentBracket = brackets.get(activeRegion);

  const simulateRound = () => {
    if (!currentBracket) return;
    engine.advanceSingleEliminationRound(currentBracket);
    setBrackets(prev => new Map(prev).set(activeRegion, { ...currentBracket }));
  };

  // Get matchup display
  const getMatchupDisplay = (matchup: PlayoffMatchup) => {
    const team1 = teams.find(t => t.tid === matchup.team1Tid);
    const team2 = teams.find(t => t.tid === matchup.team2Tid);

    if (!team1 && !team2) {
      return <span className="text-muted">TBD</span>;
    }

    return (
      <div className="d-flex justify-content-between align-items-center">
        <div>
          {team1 ? (
            <span className={matchup.winner === team1.tid ? 'fw-bold text-success' : ''}>
              {matchup.team1Seed && <small className="text-muted me-2">#{matchup.team1Seed}</small>}
              {team1.name}
              {matchup.score && <span className="ms-2">{matchup.score.team1}</span>}
            </span>
          ) : (
            <span className="text-muted">TBD</span>
          )}
        </div>
        <div className="mx-2">vs</div>
        <div>
          {team2 ? (
            <span className={matchup.winner === team2.tid ? 'fw-bold text-success' : ''}>
              {matchup.score && <span className="me-2">{matchup.score.team2}</span>}
              {team2.name}
              {matchup.team2Seed && <small className="text-muted ms-2">#{matchup.team2Seed}</small>}
            </span>
          ) : (
            <span className="text-muted">TBD</span>
          )}
        </div>
      </div>
    );
  };

  // Get round name
  const getRoundName = (region: RegionKey, round: number): string => {
    if (region === 'originContinent') {
      switch (round) {
        case 1: return 'Quarter Finals';
        case 2: return 'Semi Finals';
        case 3: return 'Finals';
        default: return `Round ${round}`;
      }
    } else {
      switch (round) {
        case 1: return 'Wild Card';
        case 2: return 'Divisional';
        case 3: return 'Conference';
        case 4: return 'Championship';
        default: return `Round ${round}`;
      }
    }
  };

  // Playoff qualifiers display
  const qualifiers = regionTeams.get(activeRegion) || [];
  const playoffTeams = activeRegion === 'originContinent' ? qualifiers.slice(0, 8) : qualifiers.slice(0, 12);

  if (!isInPlayoffs) {
    return (
      <Card className="p-4">
        <Alert variant="info">
          <h5>Playoffs Not Started</h5>
          <p className="mb-0">
            The playoff phase hasn't begun yet. Complete the regular season to qualify for playoffs.
          </p>
        </Alert>

        <h5 className="mt-4">Projected Qualifiers - {activeRegion}</h5>
        <Table striped size="sm">
          <thead>
            <tr>
              <th>Seed</th>
              <th>Team</th>
              <th>Record</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {playoffTeams.map((team, idx) => {
              const record = engine.getStandings().find(s => s.tid === team.tid);
              const seed = idx + 1;
              const hasBye = activeRegion !== 'originContinent' && seed <= 4;

              return (
                <tr key={team.tid}>
                  <td>{seed}</td>
                  <td>{team.name}</td>
                  <td>
                    {record ? `${record.won}-${record.lost}` : '0-0'}
                  </td>
                  <td>
                    {hasBye && <Badge bg="success">First Round Bye</Badge>}
                    {seed > 4 && seed <= 12 && <Badge bg="warning">Wild Card</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    );
  }

  return (
    <div className="playoffs-view">
      <Card className="p-4 mb-4">
        <Row className="align-items-center">
          <Col>
            <h4>Playoffs - Season {season}</h4>
          </Col>
          <Col xs="auto">
            {currentBracket && !engine.isPlayoffComplete(currentBracket) && (
              <Button variant="primary" onClick={simulateRound}>
                Sim Round
              </Button>
            )}
            {!currentBracket && (
              <Button variant="success" onClick={() => initializePlayoffs(activeRegion)}>
                Start Playoffs
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* Region Tabs */}
      <Tabs
        activeKey={activeRegion}
        onSelect={(k) => setActiveRegion(k as RegionKey)}
        className="mb-3"
      >
        <Tab eventKey="firstContinent" title="First Continent" />
        <Tab eventKey="secondContinent" title="Second Continent" />
        <Tab eventKey="originContinent" title="Origin Continent" />
      </Tabs>

      {/* Playoff Bracket */}
      {currentBracket ? (
        <Card className="p-4">
          {currentBracket.champion && (
            <Alert variant="success" className="mb-4">
              <h5 className="mb-0">
                🏆 Champion: {teams.find(t => t.tid === currentBracket.champion)?.name}
              </h5>
            </Alert>
          )}

          {/* Display rounds */}
          {Array.from(new Set(currentBracket.matchups.map(m => m.round))).map(round => {
            const roundMatchups = currentBracket.matchups.filter(m => m.round === round);

            return (
              <div key={round} className="mb-4">
                <h5>{getRoundName(activeRegion, round)}</h5>
                <Card className="mb-2">
                  <Card.Body>
                    {roundMatchups.map(matchup => (
                      <div
                        key={matchup.matchupId}
                        className="p-2 border-bottom"
                      >
                        {getMatchupDisplay(matchup)}
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              </div>
            );
          })}
        </Card>
      ) : (
        <Card className="p-4">
          <Alert variant="info">
            Click "Start Playoffs" to generate the playoff bracket for {activeRegion}.
          </Alert>

          <h5>Qualifying Teams</h5>
          <Table striped size="sm">
            <thead>
              <tr>
                <th>Seed</th>
                <th>Team</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {playoffTeams.map((team, idx) => {
                const record = engine.getStandings().find(s => s.tid === team.tid);
                return (
                  <tr key={team.tid}>
                    <td>{idx + 1}</td>
                    <td>{team.name}</td>
                    <td>{record ? `${record.won}-${record.lost}` : '0-0'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Mining Island Note */}
      {activeRegion === 'miningIsland' && (
        <Alert variant="warning">
          Mining Island uses a promotion/relegation system instead of playoffs.
          Top 3 teams advance to the next tier; bottom 3 are relegated.
        </Alert>
      )}
    </div>
  );
}

export default PlayoffsView;
