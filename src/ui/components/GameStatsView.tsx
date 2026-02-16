import { Card, Table, Badge, Row, Col, Tab, Tabs } from 'react-bootstrap';
import type { PlayerGameSim } from '@worker/core/game/types';

interface GameStatsViewProps {
  teamNames: [string, string];
  teamColors: [[string, string, string], [string, string, string]];
  teams: [PlayerGameSim[], PlayerGameSim[]];
  teamStats: [Record<string, number>, Record<string, number>];
  scores: [number, number];
  penalties?: {
    team0Penalties: number;
    team0Yards: number;
    team1Penalties: number;
    team1Yards: number;
  };
  injuries?: { player: PlayerGameSim; injury: any }[];
}

// Helper functions - must be defined before use
function formatStat(value: number): string {
  return value?.toString() || '0';
}

function getPlayerStat(player: PlayerGameSim, stat: string): number {
  return player.stat?.[stat] || 0;
}

function renderPlayerRow(
  player: PlayerGameSim,
  pos: string,
  stats: { label: string; value: number }[]
): JSX.Element {
  return (
    <tr key={player.pid}>
      <td width="40%">{player.name}</td>
      <td width="15%"><Badge bg="secondary">{pos}</Badge></td>
      <td width="45%">
        {stats.map(s => (
          <span key={s.label} className="me-2">
            {s.label}: {formatStat(s.value)}
          </span>
        ))}
      </td>
    </tr>
  );
}

function renderPlayerStats(performers: {
  topQB?: PlayerGameSim;
  topRB?: PlayerGameSim;
  topWR?: PlayerGameSim;
  topDef?: PlayerGameSim;
}): JSX.Element {
  return (
    <Table bordered hover size="sm" className="mb-0">
      <tbody>
        {performers.topQB && renderPlayerRow(performers.topQB, 'QB', [
          { label: 'Yds', value: getPlayerStat(performers.topQB, 'pssYds') },
          { label: 'TD', value: getPlayerStat(performers.topQB, 'pssTD') },
          { label: 'INT', value: getPlayerStat(performers.topQB, 'pssSk') },
        ])}
        {performers.topRB && renderPlayerRow(performers.topRB, 'RB', [
          { label: 'Yds', value: getPlayerStat(performers.topRB, 'rusYds') },
          { label: 'TD', value: getPlayerStat(performers.topRB, 'rusTD') },
          { label: 'Car', value: getPlayerStat(performers.topRB, 'rus') },
        ])}
        {(performers.topWR) && renderPlayerRow(performers.topWR, performers.topWR.pos, [
          { label: 'Rec', value: getPlayerStat(performers.topWR, 'rec') },
          { label: 'Yds', value: getPlayerStat(performers.topWR, 'recYds') },
          { label: 'TD', value: getPlayerStat(performers.topWR, 'recTD') },
        ])}
        {performers.topDef && renderPlayerRow(performers.topDef, performers.topDef.pos, [
          { label: 'Tck', value: getPlayerStat(performers.topDef, 'defTck') },
          { label: 'Sk', value: getPlayerStat(performers.topDef, 'defSk') },
          { label: 'Int', value: getPlayerStat(performers.topDef, 'defInt') },
        ])}
      </tbody>
    </Table>
  );
}

function GameStatsView({
  teamNames,
  teamColors,
  teams,
  teamStats,
  scores,
  penalties,
  injuries,
}: GameStatsViewProps) {
  const [primaryColor0] = [teamColors[0][0]];
  const [primaryColor1] = [teamColors[1][0]];

  // Get stats for a specific player
  const getPlayerStat = (player: PlayerGameSim, stat: string): number => {
    return player.stat?.[stat] || 0;
  };

  // Calculate team totals
  const getTeamStat = (teamIndex: number, stat: string): number => {
    return teamStats[teamIndex]?.[stat] || 0;
  };

  // Get top performers by position
  const getTopPerformers = (teamIndex: number) => {
    const players = teams[teamIndex];

    const topQB = players.filter(p => p.pos === 'QB').sort((a, b) =>
      getPlayerStat(b, 'pssYds') - getPlayerStat(a, 'pssYds')
    )[0];

    const topRB = players.filter(p => p.pos === 'RB').sort((a, b) =>
      getPlayerStat(b, 'rusYds') - getPlayerStat(a, 'rusYds')
    )[0];

    const topWR = players.filter(p => p.pos === 'WR' || p.pos === 'TE').sort((a, b) =>
      (getPlayerStat(b, 'recYds') + getPlayerStat(b, 'rec')) - (getPlayerStat(a, 'recYds') + getPlayerStat(a, 'rec'))
    )[0];

    const topDef = players.filter(p => ['DL', 'LB', 'CB', 'S'].includes(p.pos)).sort((a, b) =>
      (getPlayerStat(b, 'defTck') + getPlayerStat(b, 'defSk') + getPlayerStat(b, 'defInt')) -
      (getPlayerStat(a, 'defTck') + getPlayerStat(a, 'defSk') + getPlayerStat(a, 'defInt'))
    )[0];

    return { topQB, topRB, topWR, topDef };
  };

  const team0Performers = getTopPerformers(0);
  const team1Performers = getTopPerformers(1);

  const winner = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;

  return (
    <div className="game-stats-view">
      {/* Final Score Banner */}
      <Card className="mb-3">
        <Card.Body className="text-center py-2">
          <h3 className="mb-0">
            <span style={{ color: primaryColor0 }}>{teamNames[0]}</span>
            {' '}
            {scores[0]} - {scores[1]}
            {' '}
            <span style={{ color: primaryColor1 }}>{teamNames[1]}</span>
            {winner !== null && (
              <Badge bg={winner === 0 ? 'success' : 'danger'} className="ms-2">
                {winner === 0 ? teamNames[0] : teamNames[1]} Win!
              </Badge>
            )}
          </h3>
        </Card.Body>
      </Card>

      <Tabs defaultActiveKey="team" className="mb-3">
        {/* Team Stats Tab */}
        <Tab eventKey="team" title="Team Stats">
          <Card>
            <Card.Body>
              <Table bordered hover responsive>
                <thead>
                  <tr>
                    <th>Statistic</th>
                    <th className="text-center" style={{ backgroundColor: primaryColor0, color: '#fff' }}>
                      {teamNames[0]}
                    </th>
                    <th className="text-center" style={{ backgroundColor: primaryColor1, color: '#fff' }}>
                      {teamNames[1]}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Points</strong></td>
                    <td className="text-center">{scores[0]}</td>
                    <td className="text-center">{scores[1]}</td>
                  </tr>
                  <tr>
                    <td>Passing Yards</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'pssYds'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'pssYds'))}</td>
                  </tr>
                  <tr>
                    <td>Rushing Yards</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'rusYds'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'rusYds'))}</td>
                  </tr>
                  <tr>
                    <td><strong>Total Yards</strong></td>
                    <td className="text-center">
                      <strong>{formatStat(getTeamStat(0, 'pssYds') + getTeamStat(0, 'rusYds'))}</strong>
                    </td>
                    <td className="text-center">
                      <strong>{formatStat(getTeamStat(1, 'pssYds') + getTeamStat(1, 'rusYds'))}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Pass TD</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'pssTD'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'pssTD'))}</td>
                  </tr>
                  <tr>
                    <td>Rush TD</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'rusTD'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'rusTD'))}</td>
                  </tr>
                  <tr>
                    <td><strong>Total TD</strong></td>
                    <td className="text-center">
                      <strong>{formatStat(getTeamStat(0, 'pssTD') + getTeamStat(0, 'rusTD'))}</strong>
                    </td>
                    <td className="text-center">
                      <strong>{formatStat(getTeamStat(1, 'pssTD') + getTeamStat(1, 'rusTD'))}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Field Goals Made</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'fg'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'fg'))}</td>
                  </tr>
                  <tr>
                    <td>Extra Points</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'xp'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'xp'))}</td>
                  </tr>
                  <tr>
                    <td>Sacks</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'defSk'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'defSk'))}</td>
                  </tr>
                  <tr>
                    <td>Turnovers</td>
                    <td className="text-center">{formatStat(getTeamStat(0, 'pssSk'))}</td>
                    <td className="text-center">{formatStat(getTeamStat(1, 'pssSk'))}</td>
                  </tr>
                  {penalties && (
                    <>
                      <tr>
                        <td>Penalties</td>
                        <td className="text-center">{penalties.team0Penalties} ({penalties.team0Yards} yds)</td>
                        <td className="text-center">{penalties.team1Penalties} ({penalties.team1Yards} yds)</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* Player Stats Tab */}
        <Tab eventKey="player" title="Player Stats">
          <Row>
            <Col md={6}>
              <Card>
                <Card.Header style={{ backgroundColor: primaryColor0, color: '#fff' }}>
                  <strong>{teamNames[0]} Leaders</strong>
                </Card.Header>
                <Card.Body className="p-0">
                  {renderPlayerStats(team0Performers)}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card>
                <Card.Header style={{ backgroundColor: primaryColor1, color: '#fff' }}>
                  <strong>{teamNames[1]} Leaders</strong>
                </Card.Header>
                <Card.Body className="p-0">
                  {renderPlayerStats(team1Performers)}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>

        {/* Injuries Tab */}
        {(injuries && injuries.length > 0) && (
          <Tab eventKey="injuries" title={`Injuries (${injuries.length})`}>
            <Card>
              <Card.Header>Injuries</Card.Header>
              <Card.Body>
                <Table bordered hover>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Position</th>
                      <th>Team</th>
                      <th>Injury Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {injuries.map((item, index) => (
                      <tr key={index}>
                        <td>{item.player.name}</td>
                        <td>{item.player.pos}</td>
                        <td>{item.player.id < 100 ? teamNames[0] : teamNames[1]}</td>
                        <td>
                          <Badge bg="danger">{item.injury.type}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Tab>
        )}
      </Tabs>
    </div>
  );
}

export default GameStatsView;
