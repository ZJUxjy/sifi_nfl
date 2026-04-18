import { useState, useMemo } from 'react';
import { Card, Table, Badge, Tabs, Tab, Alert, Row, Col, Button } from 'react-bootstrap';
import { useGameStore, useUserTeam } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import type { Region } from '@common/types';

interface PromotionRelegationViewProps {
  // No props needed - uses global state
}

type RegionKey = 'miningIsland' | 'originContinent';

function PromotionRelegationView({}: PromotionRelegationViewProps) {
  const { season, teams, phase } = useGameStore();
  const userTeam = useUserTeam();
  const engine = getGameEngine();
  const [activeRegion, setActiveRegion] = useState<RegionKey>(
    userTeam?.region === 'miningIsland' ? 'miningIsland' : 'originContinent'
  );

  // Get promotion/relegation data
  const prData = useMemo(() => {
    return engine.calculateSeasonEndPromotionRelegation();
  }, [engine, season]);

  // Get standings for active region
  const standings = useMemo(() => {
    const allStandings = engine.getStandings();
    return allStandings
      .filter(s => s.region === activeRegion)
      .sort((a, b) => b.winPct - a.winPct);
  }, [engine, activeRegion]);

  // Get promotion/relegation zones
  const zones = useMemo(() => {
    return engine.getPromotionRelegationZones(activeRegion);
  }, [engine, activeRegion]);

  // Check if season is complete (simplified check)
  const isSeasonComplete = phase >= 4;

  // Format league name
  const formatLeagueName = (league: string): string => {
    const names: Record<string, string> = {
      superLeague: 'Super League (Tier 1)',
      championship: 'Championship (Tier 2)',
      aLeague: 'A League (Tier 3)',
      bLeague: 'B League (Tier 4)',
    };
    return names[league] || league;
  };

  // Get team by tid
  const getTeam = (tid: number) => teams.find(t => t.tid === tid);

  // Render Mining Island pyramid
  const renderMiningIslandPyramid = () => {
    const miningStandings = engine.getMiningIslandStandings();
    const leagueOrder = ['superLeague', 'championship', 'aLeague', 'bLeague'];

    return (
      <div className="pyramid-view">
        <Alert variant="info" className="mb-4">
          <h6 className="mb-2">⛏️ Mining Island Pyramid System</h6>
          <p className="mb-0 small">
            4-tier league system with promotion and relegation.
            Top 3 teams from each tier are promoted to the tier above.
            Bottom 3 teams are relegated to the tier below.
          </p>
        </Alert>

        {leagueOrder.map((league, leagueIndex) => {
          const leagueStandings = miningStandings.get(league) || [];
          const isTopTier = leagueIndex === 0;
          const isBottomTier = leagueIndex === leagueOrder.length - 1;

          return (
            <Card key={league} className="mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{formatLeagueName(league)}</h5>
                <Badge bg="secondary">{leagueStandings.length} teams</Badge>
              </Card.Header>
              <Card.Body className="p-0">
                <Table striped size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>PCT</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueStandings.map((standing, idx) => {
                      const team = getTeam(standing.tid);
                      const isPromotion = !isTopTier && idx < 3;
                      const isRelegation = !isBottomTier && idx >= leagueStandings.length - 3;
                      const isUserTeam = userTeam?.tid === standing.tid;

                      return (
                        <tr
                          key={standing.tid}
                          className={isUserTeam ? 'table-primary' : ''}
                        >
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{team?.name || 'Unknown'}</strong>
                            {isUserTeam && (
                              <Badge bg="primary" className="ms-2">You</Badge>
                            )}
                          </td>
                          <td>{standing.won}</td>
                          <td>{standing.lost}</td>
                          <td>{standing.winPct.toFixed(3)}</td>
                          <td>
                            {isPromotion && (
                              <Badge bg="success">
                                ⬆️ Promotion Zone
                              </Badge>
                            )}
                            {isRelegation && (
                              <Badge bg="danger">
                                ⬇️ Relegation Zone
                              </Badge>
                            )}
                            {!isPromotion && !isRelegation && (
                              <Badge bg="secondary">Safe</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          );
        })}
      </div>
    );
  };

  // Render Origin Continent leagues
  const renderOriginContinentLeagues = () => {
    // Divide teams into 3 leagues
    const leagueNames = ['Metropolis League', 'Imperial League', 'Royal League'];
    const teamsPerLeague = Math.ceil(standings.length / 3);

    return (
      <div className="origin-leagues-view">
        <Alert variant="info" className="mb-4">
          <h6 className="mb-2">🌍 Origin Continent League System</h6>
          <p className="mb-0 small">
            3 parallel leagues with 12 teams each. After Phase 1, teams split into
            Championship Group (top 4 from each) and Relegation Group (bottom 8).
            Bottom team from each league is directly relegated; second-to-bottom
            enters relegation playoff.
          </p>
        </Alert>

        {leagueNames.map((leagueName, leagueIndex) => {
          const startIdx = leagueIndex * teamsPerLeague;
          const leagueStandings = standings.slice(startIdx, startIdx + teamsPerLeague);

          return (
            <Card key={leagueName} className="mb-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">{leagueName}</h5>
                <Badge bg="secondary">{leagueStandings.length} teams</Badge>
              </Card.Header>
              <Card.Body className="p-0">
                <Table striped size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>PCT</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leagueStandings.map((standing, idx) => {
                      const team = getTeam(standing.tid);
                      const isChampionship = idx < 4;
                      const isDirectRelegation = idx === leagueStandings.length - 1;
                      const isPlayoffCandidate = idx === leagueStandings.length - 2;
                      const isUserTeam = userTeam?.tid === standing.tid;

                      return (
                        <tr
                          key={standing.tid}
                          className={isUserTeam ? 'table-primary' : ''}
                        >
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{team?.name || 'Unknown'}</strong>
                            {isUserTeam && (
                              <Badge bg="primary" className="ms-2">You</Badge>
                            )}
                          </td>
                          <td>{standing.won}</td>
                          <td>{standing.lost}</td>
                          <td>{standing.winPct.toFixed(3)}</td>
                          <td>
                            {isChampionship && (
                              <Badge bg="success">
                                🏆 Championship Group
                              </Badge>
                            )}
                            {isDirectRelegation && (
                              <Badge bg="danger">
                                ⬇️ Direct Relegation
                              </Badge>
                            )}
                            {isPlayoffCandidate && (
                              <Badge bg="warning">
                                ⚠️ Relegation Playoff
                              </Badge>
                            )}
                            {!isChampionship && !isDirectRelegation && !isPlayoffCandidate && (
                              <Badge bg="secondary">Relegation Group</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          );
        })}

        {/* Relegation Playoff Preview */}
        <Card className="mt-4">
          <Card.Header>
            <h5 className="mb-0">Relegation Playoff</h5>
          </Card.Header>
          <Card.Body>
            <Alert variant="warning" className="mb-3">
              The 2nd-to-last team from each Origin Continent league enters a
              relegation playoff against top teams from lower divisions to
              determine who stays in the top tier.
            </Alert>
            <p className="text-muted small mb-0">
              Relegation playoffs are simulated at the end of the season.
            </p>
          </Card.Body>
        </Card>
      </div>
    );
  };

  // Render season-end summary
  const renderSeasonEndSummary = () => {
    if (!isSeasonComplete) {
      return (
        <Alert variant="secondary" className="mb-4">
          <h6 className="mb-2">Season In Progress</h6>
          <p className="mb-0">
            Promotion and relegation will be determined at the end of the season.
            Current zones shown are projections based on current standings.
          </p>
        </Alert>
      );
    }

    const data = activeRegion === 'miningIsland'
      ? prData.miningIsland
      : prData.originContinent;

    return (
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Season {season} Results</h5>
        </Card.Header>
        <Card.Body>
          {activeRegion === 'miningIsland' && (
            <>
              <Row>
                <Col md={6}>
                  <h6 className="text-success">⬆️ Promoted Teams</h6>
                  {(data as typeof prData.miningIsland).promoted.length > 0 ? (
                    <ul>
                      {(data as typeof prData.miningIsland).promoted.map(p => (
                        <li key={p.tid}>
                          {getTeam(p.tid)?.name} - {formatLeagueName(p.fromLeague)} → {formatLeagueName(p.toLeague)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No promotions yet</p>
                  )}
                </Col>
                <Col md={6}>
                  <h6 className="text-danger">⬇️ Relegated Teams</h6>
                  {(data as typeof prData.miningIsland).relegated.length > 0 ? (
                    <ul>
                      {(data as typeof prData.miningIsland).relegated.map(r => (
                        <li key={r.tid}>
                          {getTeam(r.tid)?.name} - {formatLeagueName(r.fromLeague)} → {formatLeagueName(r.toLeague)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted">No relegations yet</p>
                  )}
                </Col>
              </Row>
            </>
          )}

          {activeRegion === 'originContinent' && (
            <Row>
              <Col md={6}>
                <h6 className="text-danger">⬇️ Direct Relegation</h6>
                {(data as typeof prData.originContinent).relegated.length > 0 ? (
                  <ul>
                    {(data as typeof prData.originContinent).relegated.map(r => (
                      <li key={r.tid}>
                        {getTeam(r.tid)?.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No direct relegations yet</p>
                )}
              </Col>
              <Col md={6}>
                <h6 className="text-warning">⚠️ Relegation Playoff</h6>
                {(data as typeof prData.originContinent).playoffCandidates.length > 0 ? (
                  <ul>
                    {(data as typeof prData.originContinent).playoffCandidates.map(p => (
                      <li key={p.tid}>
                        {getTeam(p.tid)?.name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted">No playoff candidates yet</p>
                )}
              </Col>
            </Row>
          )}
        </Card.Body>
      </Card>
    );
  };

  // Only show for Mining Island and Origin Continent
  if (userTeam && userTeam.region !== 'miningIsland' && userTeam.region !== 'originContinent') {
    return (
      <Card className="p-4">
        <Alert variant="info">
          <h5>Promotion/Relegation Not Available</h5>
          <p className="mb-0">
            Your team is in <strong>{userTeam.region}</strong>, which uses a
            closed league system without promotion or relegation.
          </p>
        </Alert>

        <h5 className="mt-4">Regions with Promotion/Relegation</h5>
        <Row>
          <Col md={6}>
            <Card className="p-3 mb-3">
              <h6>⛏️ Mining Island</h6>
              <p className="small text-muted mb-0">
                4-tier pyramid system. Top 3 promoted, bottom 3 relegated each season.
              </p>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="p-3 mb-3">
              <h6>🌍 Origin Continent</h6>
              <p className="small text-muted mb-0">
                3 parallel leagues with relegation playoffs. Bottom teams face relegation.
              </p>
            </Card>
          </Col>
        </Row>
      </Card>
    );
  }

  return (
    <div className="promotion-relegation-view">
      <Card className="p-4 mb-4">
        <Row className="align-items-center">
          <Col>
            <h4>Promotion & Relegation - Season {season}</h4>
            <p className="text-muted mb-0">
              View league standings with promotion and relegation zones
            </p>
          </Col>
        </Row>
      </Card>

      {/* Season End Summary */}
      {renderSeasonEndSummary()}

      {/* Region Tabs */}
      <Tabs
        activeKey={activeRegion}
        onSelect={(k) => setActiveRegion(k as RegionKey)}
        className="mb-3"
      >
        <Tab eventKey="miningIsland" title="⛏️ Mining Island" />
        <Tab eventKey="originContinent" title="🌍 Origin Continent" />
      </Tabs>

      {/* League Tables */}
      {activeRegion === 'miningIsland' && renderMiningIslandPyramid()}
      {activeRegion === 'originContinent' && renderOriginContinentLeagues()}
    </div>
  );
}

export default PromotionRelegationView;
