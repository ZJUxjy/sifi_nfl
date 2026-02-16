import { Card, Badge } from 'react-bootstrap';

interface ScoreboardProps {
  teamNames: [string, string];
  teamColors: [[string, string, string], [string, string, string]];
  scores: [number, number];
  quarter: number;
  clock: number;
  down?: number;
  toGo?: number;
  scrimmage?: number;
  isOvertime?: boolean;
  possession?: 0 | 1;
}

function formatClock(clock: number): string {
  const minutes = Math.floor(clock);
  const seconds = Math.floor((clock % 1) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatQuarter(quarter: number, isOvertime?: boolean): string {
  if (isOvertime) {
    if (quarter === 5) return 'OT';
    return `OT${quarter - 4}`;
  }
  const quarterNames = ['1st', '2nd', '3rd', '4th'];
  return quarterNames[quarter - 1] || `${quarter}th`;
}

function formatDownAndDistance(down?: number, toGo?: number, scrimmage?: number): string {
  if (down === undefined || toGo === undefined || scrimmage === undefined) {
    return '';
  }

  const distance = toGo === 0 || scrimmage >= 100 ? 'Goal' : toGo.toString();
  return `${down}${getOrdinal(down)} & ${distance}`;
}

function formatFieldPosition(scrimmage: number, possession: 0 | 1): string {
  if (scrimmage >= 100) return 'Goal';
  if (scrimmage <= 0) return 'Goal';

  if (scrimmage <= 50) {
    return `${50 - scrimmage}`;
  }
  return `${scrimmage - 50}`;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function Scoreboard({
  teamNames,
  teamColors,
  scores,
  quarter,
  clock,
  down,
  toGo,
  scrimmage,
  isOvertime,
  possession,
}: ScoreboardProps) {
  const [primaryColor0, secondaryColor0] = [teamColors[0][0], teamColors[0][1]];
  const [primaryColor1, secondaryColor1] = [teamColors[1][0], teamColors[1][1]];

  const possessionIndicator = possession !== undefined ? (
    <div
      className="possession-indicator"
      style={{
        backgroundColor: possession === 0 ? primaryColor0 : primaryColor1,
      }}
    />
  ) : null;

  return (
    <Card className="scoreboard mb-3">
      <Card.Body className="p-0">
        <div className="scoreboard-content">
          {/* Team 0 */}
          <div
            className="team-score"
            style={{
              backgroundColor: primaryColor0,
              color: '#fff',
            }}
          >
            <div className="team-name">{teamNames[0]}</div>
            <div className="team-score-value">{scores[0]}</div>
            {possession === 0 && possessionIndicator}
          </div>

          {/* Center Info */}
          <div className="scoreboard-center">
            <div className="quarter">{formatQuarter(quarter, isOvertime)}</div>
            <div className="clock">{formatClock(clock)}</div>
            {down !== undefined && toGo !== undefined && scrimmage !== undefined && (
              <>
                <div className="down-distance">
                  {formatDownAndDistance(down, toGo, scrimmage)}
                </div>
                {possession !== undefined && (
                  <div className="field-position">
                    @ {formatFieldPosition(scrimmage, possession)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Team 1 */}
          <div
            className="team-score"
            style={{
              backgroundColor: primaryColor1,
              color: '#fff',
            }}
          >
            <div className="team-name">{teamNames[1]}</div>
            <div className="team-score-value">{scores[1]}</div>
            {possession === 1 && possessionIndicator}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default Scoreboard;
