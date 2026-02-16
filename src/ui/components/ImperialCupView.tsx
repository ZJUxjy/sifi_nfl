import { useState, useMemo } from 'react';
import {
  Card,
  Badge,
  Button,
  Alert,
  Row,
  Col,
  Table,
  Modal,
} from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import {
  isImperialCupYear,
  getNextImperialCupYear,
  qualifyForImperialCup,
  generateImperialCupBracket,
  getRoundName,
  advanceRound,
  IMPERIAL_CUP_HISTORY,
  IMPERIAL_CUP_QUALIFYING,
  type ImperialCupMatch,
  type ImperialCupSeason,
  type ImperialCupRound,
} from '@worker/core/imperialCup';
import type { Team } from '@common/entities';

interface ImperialCupViewProps {
  team: Team;
}

function ImperialCupView({ team }: ImperialCupViewProps) {
  const { season, teams, syncState } = useGameStore();
  const engine = getGameEngine();

  const [imperialCup, setImperialCup] = useState<ImperialCupSeason | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ImperialCupMatch | null>(null);

  const isCupYear = isImperialCupYear(season);
  const nextCupYear = getNextImperialCupYear(season);

  // Get standings for qualification
  const standings = useMemo(() => {
    return engine.getStandings();
  }, [engine]);

  // Initialize or get imperial cup
  const currentImperialCup = useMemo(() => {
    if (!isCupYear) return null;

    // Check if we already have imperial cup data in engine state
    // For now, we'll generate it on the fly
    if (!imperialCup) {
      const qualified = qualifyForImperialCup(teams, standings);
      const matches = generateImperialCupBracket(qualified);
      return {
        season,
        qualifiedTeams: qualified,
        matches,
        completed: false,
      };
    }

    return imperialCup;
  }, [isCupYear, season, teams, standings, imperialCup]);

  // Get team's participation status
  const teamStatus = useMemo(() => {
    if (!currentImperialCup) return null;

    const isQualified = currentImperialCup.qualifiedTeams.includes(team.tid);
    const currentMatch = currentImperialCup.matches.find(
      m => m.homeTid === team.tid || m.awayTid === team.tid
    );

    // Check if team has been eliminated
    let eliminated = false;
    if (isQualified && !currentMatch) {
      // Check if there are matches in later rounds without this team
      const hasLaterMatches = currentImperialCup.matches.some(
        m => !m.played && m.round !== 'roundOf16'
      );
      eliminated = hasLaterMatches;
    }

    // Check if team is champion
    const isChampion = currentImperialCup.champion === team.tid;

    return { isQualified, currentMatch, eliminated, isChampion };
  }, [currentImperialCup, team]);

  // Get matches by round
  const matchesByRound = useMemo(() => {
    if (!currentImperialCup) return {} as Record<ImperialCupRound, ImperialCupMatch[]>;

    const rounds: Record<ImperialCupRound, ImperialCupMatch[]> = {
      roundOf16: [],
      quarterfinals: [],
      semifinals: [],
      final: [],
    };

    for (const match of currentImperialCup.matches) {
      rounds[match.round].push(match);
    }

    return rounds;
  }, [currentImperialCup]);

  // Handle viewing match
  const handleViewMatch = (match: ImperialCupMatch) => {
    setSelectedMatch(match);
    setShowMatchModal(true);
  };

  // Handle simulating match
  const handleSimMatch = (match: ImperialCupMatch) => {
    if (match.played) return;

    // Simulate match (simple random result)
    const homeScore = Math.floor(Math.random() * 35) + 10;
    const awayScore = Math.floor(Math.random() * 35) + 10;

    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.winnerTid = homeScore > awayScore ? match.homeTid : match.awayTid;
    match.played = true;

    // Check if round is complete
    const roundMatches = matchesByRound[match.round];
    const roundComplete = roundMatches.every(m => m.played);

    if (roundComplete) {
      // Advance to next round
      const nextRoundMatches = advanceRound(currentImperialCup!.matches);
      if (nextRoundMatches) {
        currentImperialCup!.matches.push(...nextRoundMatches);
      } else if (match.round === 'final') {
        currentImperialCup!.completed = true;
        currentImperialCup!.champion = match.winnerTid;
      }
    }

    setImperialCup({ ...currentImperialCup! });
    syncState();
  };

  // Handle simulating all matches
  const handleSimAll = () => {
    if (!currentImperialCup) return;

    let matches = currentImperialCup.matches;

    while (matches.length > 0) {
      // Sim all current round matches
      for (const match of matches) {
        if (!match.played) {
          match.homeScore = Math.floor(Math.random() * 35) + 10;
          match.awayScore = Math.floor(Math.random() * 35) + 10;
          match.winnerTid = match.homeScore! > match.awayScore! ? match.homeTid : match.awayTid;
          match.played = true;
        }
      }

      // Try to advance
      const nextRoundMatches = advanceRound(matches);
      if (nextRoundMatches) {
        currentImperialCup.matches.push(...nextRoundMatches);
        matches = nextRoundMatches;
      } else {
        break;
      }
    }

    const final = currentImperialCup.matches.find(m => m.round === 'final');
    if (final?.winnerTid) {
      currentImperialCup.completed = true;
      currentImperialCup.champion = final.winnerTid;
    }

    setImperialCup({ ...currentImperialCup });
    syncState();
  };

  const getTeamName = (tid: number) => {
    const t = teams.find(tm => tm.tid === tid);
    return t?.name || `Team ${tid}`;
  };

  const getTeamRegion = (tid: number) => {
    const t = teams.find(tm => tm.tid === tid);
    return t?.region || 'unknown';
  };

  return (
    <div className="imperial-cup-view">
      {/* Header */}
      <Card className="p-4 mb-4">
        <div className="text-center">
          <h2 style={{ color: '#ffd700' }}>🏆 Imperial Cup {season}</h2>
          <p className="text-muted mb-0">
            The premier inter-region championship
          </p>
        </div>
      </Card>

      {/* Not a Cup Year */}
      {!isCupYear && (
        <Alert variant="info">
          <h5>⏰ Next Imperial Cup: {nextCupYear}</h5>
          <p className="mb-0">
            The Imperial Cup is held every 4 years. The next tournament will be in {nextCupYear},
            {nextCupYear - season} {nextCupYear - season === 1 ? 'year' : 'years'} from now.
          </p>
        </Alert>
      )}

      {/* Cup Year - Not Qualified */}
      {isCupYear && teamStatus && !teamStatus.isQualified && (
        <Alert variant="warning">
          <h5>⚠️ Your Team Did Not Qualify</h5>
          <p className="mb-0">
            Your team needs to finish in the top positions of your region to qualify for the Imperial Cup.
            <br />
            Qualification spots: {IMPERIAL_CUP_QUALIFYING[team.region]} from {team.region}
          </p>
        </Alert>
      )}

      {/* Cup Year - Qualified */}
      {isCupYear && teamStatus?.isQualified && (
        <>
          {/* Status Card */}
          <Card className="p-4 mb-4">
            <Row className="text-center">
              <Col md={4}>
                <div className="stat-value">
                  {currentImperialCup?.qualifiedTeams.length || 0}
                </div>
                <small className="text-muted">Qualified Teams</small>
              </Col>
              <Col md={4}>
                <div className="stat-value">
                  {currentImperialCup?.matches.filter(m => m.played).length || 0} / {currentImperialCup?.matches.length || 0}
                </div>
                <small className="text-muted">Matches Played</small>
              </Col>
              <Col md={4}>
                {teamStatus.isChampion ? (
                  <div className="stat-value" style={{ color: '#ffd700' }}>🏆 Champion!</div>
                ) : teamStatus.eliminated ? (
                  <div className="stat-value" style={{ color: '#ef4444' }}>Eliminated</div>
                ) : teamStatus.currentMatch ? (
                  <Badge bg="success" className="fs-6">Still In</Badge>
                ) : (
                  <Badge bg="secondary">-</Badge>
                )}
                <small className="text-muted">Your Status</small>
              </Col>
            </Row>
          </Card>

          {/* Bracket Display */}
          <Card className="p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="mb-0">Tournament Bracket</h5>
              {!currentImperialCup?.completed && (
                <Button variant="primary" onClick={handleSimAll}>
                  Sim All Matches
                </Button>
              )}
            </div>

            {/* Round of 16 */}
            {(matchesByRound.roundOf16?.length || 0) > 0 && (
              <div className="mb-4">
                <h6>{getRoundName('roundOf16')}</h6>
                <Row>
                  {matchesByRound.roundOf16!.map((match: ImperialCupMatch, i: number) => (
                    <Col md={6} lg={3} key={i} className="mb-3">
                      <MatchCard
                        match={match}
                        getTeamName={getTeamName}
                        getTeamRegion={getTeamRegion}
                        isUserMatch={match.homeTid === team.tid || match.awayTid === team.tid}
                        onView={handleViewMatch}
                        onSim={handleSimMatch}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Quarterfinals */}
            {(matchesByRound.quarterfinals?.length || 0) > 0 && (
              <div className="mb-4">
                <h6>{getRoundName('quarterfinals')}</h6>
                <Row>
                  {matchesByRound.quarterfinals!.map((match: ImperialCupMatch, i: number) => (
                    <Col md={6} lg={3} key={i} className="mb-3">
                      <MatchCard
                        match={match}
                        getTeamName={getTeamName}
                        getTeamRegion={getTeamRegion}
                        isUserMatch={match.homeTid === team.tid || match.awayTid === team.tid}
                        onView={handleViewMatch}
                        onSim={handleSimMatch}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Semifinals */}
            {(matchesByRound.semifinals?.length || 0) > 0 && (
              <div className="mb-4">
                <h6>{getRoundName('semifinals')}</h6>
                <Row>
                  {matchesByRound.semifinals!.map((match: ImperialCupMatch, i: number) => (
                    <Col md={6} key={i} className="mb-3">
                      <MatchCard
                        match={match}
                        getTeamName={getTeamName}
                        getTeamRegion={getTeamRegion}
                        isUserMatch={match.homeTid === team.tid || match.awayTid === team.tid}
                        onView={handleViewMatch}
                        onSim={handleSimMatch}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Final */}
            {(matchesByRound.final?.length || 0) > 0 && (
              <div>
                <h6>{getRoundName('final')}</h6>
                <Row>
                  {matchesByRound.final!.map((match: ImperialCupMatch, i: number) => (
                    <Col md={6} lg={{ span: 4, offset: 3 }} key={i} className="mb-3">
                      <MatchCard
                        match={match}
                        getTeamName={getTeamName}
                        getTeamRegion={getTeamRegion}
                        isUserMatch={match.homeTid === team.tid || match.awayTid === team.tid}
                        onView={handleViewMatch}
                        onSim={handleSimMatch}
                        isFinal
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {currentImperialCup?.completed && currentImperialCup.champion && (
              <Alert variant="success" className="mt-4 text-center">
                <h5>🏆 Imperial Cup {season} Champion: {getTeamName(currentImperialCup.champion)}</h5>
              </Alert>
            )}
          </Card>
        </>
      )}

      {/* History Section */}
      <Card className="p-4">
        <h5 className="mb-3">📜 Imperial Cup History</h5>
        <Table hover responsive>
          <thead>
            <tr>
              <th>Season</th>
              <th>Champion</th>
              <th>Runner-Up</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {IMPERIAL_CUP_HISTORY.map((entry, i) => (
              <tr key={i}>
                <td>{entry.season}</td>
                <td>
                  <strong style={{ color: '#ffd700' }}>{entry.champion}</strong>
                </td>
                <td>{entry.runnerUp}</td>
                <td>{entry.score}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Match Detail Modal */}
      <Modal show={showMatchModal} onHide={() => setShowMatchModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedMatch && `${getRoundName(selectedMatch.round)} - ${getTeamName(selectedMatch.homeTid)} vs ${getTeamName(selectedMatch.awayTid)}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedMatch && (
            <div>
              <Row className="text-center mb-4">
                <Col md={5}>
                  <h4>{getTeamName(selectedMatch.homeTid)}</h4>
                  <Badge bg="secondary">{getTeamRegion(selectedMatch.homeTid)}</Badge>
                </Col>
                <Col md={2}>
                  <h2>
                    {selectedMatch.played ? (
                      <>
                        {selectedMatch.homeScore} - {selectedMatch.awayScore}
                      </>
                    ) : (
                      'vs'
                    )}
                  </h2>
                </Col>
                <Col md={5}>
                  <h4>{getTeamName(selectedMatch.awayTid)}</h4>
                  <Badge bg="secondary">{getTeamRegion(selectedMatch.awayTid)}</Badge>
                </Col>
              </Row>

              {selectedMatch.played && selectedMatch.winnerTid && (
                <Alert variant="success" className="text-center">
                  <h5>🏆 Winner: {getTeamName(selectedMatch.winnerTid)}</h5>
                </Alert>
              )}

              {!selectedMatch.played && (
                <div className="text-center">
                  <Button variant="primary" onClick={() => handleSimMatch(selectedMatch)}>
                    Sim Match
                  </Button>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMatchModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// Match Card Component
interface MatchCardProps {
  match: ImperialCupMatch;
  getTeamName: (tid: number) => string;
  getTeamRegion: (tid: number) => string;
  isUserMatch: boolean;
  onView: (match: ImperialCupMatch) => void;
  onSim: (match: ImperialCupMatch) => void;
  isFinal?: boolean;
}

function MatchCard({ match, getTeamName, getTeamRegion, isUserMatch, onView, onSim, isFinal }: MatchCardProps) {
  const CardStyle = isFinal
    ? { border: '2px solid #ffd700', background: 'linear-gradient(135deg, #fff9e6 0%, #ffffff 100%)' }
    : isUserMatch
    ? { border: '2px solid #00d4ff' }
    : {};

  return (
    <Card
      className="p-3 h-100"
      style={CardStyle}
    >
      {isFinal && (
        <div className="text-center mb-2">
          <Badge bg="warning">🏆 FINAL</Badge>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-2">
        <small className="text-muted">{getTeamRegion(match.homeTid)}</small>
        {isUserMatch && <Badge bg="info">You</Badge>}
      </div>

      <div className="mb-2">
        <strong>{getTeamName(match.homeTid)}</strong>
      </div>

      <div className="text-center mb-2">
        {match.played ? (
          <h4 className="mb-0">
            {match.homeScore} - {match.awayScore}
          </h4>
        ) : (
          <span className="text-muted">vs</span>
        )}
      </div>

      <div className="mb-2">
        <strong>{getTeamName(match.awayTid)}</strong>
      </div>

      <div className="d-flex justify-content-between align-items-center">
        <small className="text-muted">{getTeamRegion(match.awayTid)}</small>
        {match.played && match.winnerTid && (
          <Badge bg={match.winnerTid === match.homeTid ? 'success' : 'danger'} className="ms-2">
            Winner
          </Badge>
        )}
      </div>

      <div className="mt-3 text-center">
        {match.played ? (
          <Button variant="outline-secondary" size="sm" onClick={() => onView(match)}>
            View Details
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={() => onSim(match)}>
            Sim Match
          </Button>
        )}
      </div>
    </Card>
  );
}

export default ImperialCupView;
