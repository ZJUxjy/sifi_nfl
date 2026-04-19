import { useMemo, useState } from 'react';
import { Table, Badge, Button, Modal, Alert } from 'react-bootstrap';
import {
  useTeams,
  usePlayers,
  useSimWeek,
  useSchedule,
  useWeek,
} from '../stores/selectors';
import type { Team } from '@common/entities';
import type { ScheduleGame } from '../../worker/api/types';
import GameSimView from './GameSimView';

// Region-specific initial schedule configuration
// Note: For Origin Continent, this is just Phase 1; Phase 2 is generated dynamically
const REGION_INITIAL_WEEKS: Record<string, number> = {
  firstContinent: 17,
  secondContinent: 17,
  miningIsland: 38,
  originContinent: 11, // Only Phase 1 initially; Phase 2 is generated after Phase 1 completes
};

interface ScheduleViewProps {
  team: Team;
}

interface DisplayScheduleGame {
  gid: number;
  week: number;
  opponent: Team;
  home: boolean;
  result?: { won: boolean; score: string };
  phase?: string;
}

function ScheduleView({ team }: ScheduleViewProps) {
  const teams = useTeams();
  const players = usePlayers();
  const simWeek = useSimWeek();
  // Subscribe to the reactive store slices so the component (and the memos
  // below) re-evaluate whenever the schedule or current week change. The
  // previous implementation called `getGameEngine().getSchedule()` directly
  // and used `teams.length` as a trigger dep, which silently went stale after
  // a `simWeek()` call (game results updated but `teams.length` didn't).
  const allSchedule = useSchedule();
  const currentWeek = useWeek();

  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<DisplayScheduleGame | null>(null);

  const scheduleGames = useMemo<ScheduleGame[]>(() => {
    return allSchedule.filter(
      g => g.homeTid === team.tid || g.awayTid === team.tid
    );
  }, [allSchedule, team.tid]);

  // Build display schedule
  const schedule = useMemo(() => {
    const games: DisplayScheduleGame[] = [];

    // Group by week
    const weekMap = new Map<number, ScheduleGame>();
    for (const game of scheduleGames) {
      weekMap.set(game.day, game);
    }

    // Get current max week from the actual schedule (which may have been extended)
    const actualMaxWeek = scheduleGames.length > 0
      ? Math.max(...scheduleGames.map(g => g.day))
      : (REGION_INITIAL_WEEKS[team.region] || 17);

    // Fill in all weeks that have games
    for (let week = 1; week <= actualMaxWeek; week++) {
      const game = weekMap.get(week);
      const opponentTid = game?.homeTid === team.tid ? game.awayTid : game?.homeTid;
      const opponent = opponentTid ? teams.find(t => t.tid === opponentTid) : undefined;

      if (opponent && game) {
        const home = game.homeTid === team.tid;
        const result = game.won ? {
          won: game.won.tid === team.tid,
          score: `${game.won.pts}-${game.lost?.pts || 0}`,
        } : undefined;

        games.push({
          gid: game.gid,
          week,
          opponent,
          home,
          result,
          phase: game.phase,
        });
      }
    }

    return games;
  }, [scheduleGames, teams, team.tid, team.region]);

  // Check if we're in Phase 1 or Phase 2 for Origin Continent
  const originPhase = useMemo(() => {
    if (team.region !== 'originContinent') return null;

    const phase1Games = schedule.filter(g => g.phase === 'phase1');
    const phase2Games = schedule.filter(g => g.phase?.startsWith('phase2'));

    if (phase1Games.length === 0) return 'phase1';
    if (phase1Games.every(g => g.result)) {
      return phase2Games.length > 0 ? 'phase2' : 'phase1-complete';
    }
    return 'phase1';
  }, [schedule, team.region]);

  const record = useMemo(() => {
    const wins = schedule.filter((g) => g.result?.won).length;
    const losses = schedule.filter((g) => g.result && !g.result.won).length;
    return { wins, losses };
  }, [schedule]);

  const handleSimWeek = async () => {
    await simWeek();
  };

  const handlePlayGame = (game: DisplayScheduleGame) => {
    setSelectedGame(game);
    setShowGameModal(true);
  };

  const handleCloseGameModal = () => {
    setShowGameModal(false);
    setSelectedGame(null);
  };

  const handleGameComplete = () => {
    handleCloseGameModal();
  };

  return (
    <div className="schedule-view">
      <div className="game-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h4 className="mb-1">Schedule</h4>
            <Badge bg="secondary">
              Record: {record.wins}-{record.losses}
            </Badge>
            {originPhase && (
              <Badge bg={originPhase === 'phase1' ? 'info' : originPhase === 'phase2' ? 'success' : 'warning'} className="ms-2">
                {originPhase === 'phase1' && 'Phase 1'}
                {originPhase === 'phase1-complete' && 'Phase 1 Complete'}
                {originPhase === 'phase2' && 'Phase 2'}
              </Badge>
            )}
          </div>
          {schedule.length > 0 && schedule.some(g => !g.result) && (
            <Button variant="primary" onClick={handleSimWeek}>
              Sim Week {currentWeek}
            </Button>
          )}
        </div>

        {originPhase === 'phase1-complete' && (
          <Alert variant="info" className="mb-3">
            Phase 1 complete! Determining championship and relegation groups...
          </Alert>
        )}

        <Table hover responsive>
          <thead>
            <tr>
              <th>Week</th>
              <th>Phase</th>
              <th>Opponent</th>
              <th>Venue</th>
              <th>Result</th>
              <th>Score</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((game) => (
              <tr
                key={game.gid}
                className={game.week === currentWeek ? 'table-warning' : ''}
              >
                <td>
                  <strong>{game.week}</strong>
                  {game.week === currentWeek && !game.result && (
                    <Badge bg="warning" text="dark" className="ms-2">Current</Badge>
                  )}
                </td>
                <td>
                  {game.phase === 'phase1' && <Badge bg="info">Phase 1</Badge>}
                  {game.phase === 'phase2-championship' && <Badge bg="success">Championship</Badge>}
                  {game.phase === 'phase2-relegation' && <Badge bg="secondary">Relegation</Badge>}
                  {!game.phase && <Badge bg="light" text="dark">Regular</Badge>}
                </td>
                <td>{game.opponent.name}</td>
                <td>
                  {game.home ? (
                    <Badge bg="success">Home</Badge>
                  ) : (
                    <Badge bg="secondary">Away</Badge>
                  )}
                </td>
                <td>
                  {game.result ? (
                    game.result.won ? (
                      <Badge bg="success">W</Badge>
                    ) : (
                      <Badge bg="danger">L</Badge>
                    )
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td>
                  {game.result ? game.result.score : '-'}
                </td>
                <td>
                  {game.week === currentWeek && !game.result && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handlePlayGame(game)}
                    >
                      Play Game
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Game Simulation Modal */}
      <Modal
        show={showGameModal}
        onHide={handleCloseGameModal}
        size="xl"
        fullscreen
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {selectedGame ? `${team.name} vs ${selectedGame.opponent.name}` : 'Game Simulation'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {selectedGame && (
            <GameSimView
              homeTeam={selectedGame.home ? team : selectedGame.opponent}
              awayTeam={selectedGame.home ? selectedGame.opponent : team}
              homePlayers={selectedGame.home ?
                players.filter(p => p.tid === team.tid) :
                players.filter(p => p.tid === selectedGame.opponent.tid)}
              awayPlayers={selectedGame.home ?
                players.filter(p => p.tid === selectedGame.opponent.tid) :
                players.filter(p => p.tid === team.tid)}
              onComplete={handleGameComplete}
              onBack={handleCloseGameModal}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default ScheduleView;
