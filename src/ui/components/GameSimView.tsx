import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Button, ButtonGroup, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { getGameEngine } from '../../worker/api';
import type {
  TeamNum,
  PlayByPlayEvent,
} from '@worker/api/types';
import type { Team, Player } from '@common/entities';
import Scoreboard from './Scoreboard';
import PlayByPlayView from './PlayByPlayView';
import GameStatsView from './GameStatsView';
import SimWorker from '../workers/simWorker?worker';
import { handleWorkerMessage } from '../workers/simWorkerClient';
import type {
  SimRequest,
  SimResponse,
  SimSpeed,
} from '../workers/simWorker.protocol';

interface GameSimViewProps {
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: Player[];
  awayPlayers: Player[];
  onComplete?: (result: any) => void;
  onBack?: () => void;
}

function GameSimView({ homeTeam, awayTeam, homePlayers, awayPlayers, onComplete, onBack }: GameSimViewProps) {
  const engine = getGameEngine();
  const [gameState, setGameState] = useState<'pregame' | 'playing' | 'paused' | 'complete'>('pregame');
  const [speed, setSpeed] = useState<SimSpeed>('normal');
  const [quarter, setQuarter] = useState(1);
  const [clock, setClock] = useState(15);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [down, setDown] = useState<number | undefined>(undefined);
  const [toGo, setToGo] = useState<number | undefined>(undefined);
  const [scrimmage, setScrimmage] = useState<number | undefined>(undefined);
  const [possession, setPossession] = useState<TeamNum | undefined>(undefined);
  const [playByPlay, setPlayByPlay] = useState<PlayByPlayEvent[]>([]);
  const [isOvertime, setIsOvertime] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const gidRef = useRef<number>(0);

  const teamNames: [string, string] = [homeTeam.name, awayTeam.name];
  const teamColors: [[string, string, string], [string, string, string]] = [homeTeam.colors, awayTeam.colors];

  const post = useCallback((msg: SimRequest) => {
    workerRef.current?.postMessage(msg);
  }, []);

  // Initialise the worker on mount; tear it down on unmount.
  useEffect(() => {
    const w = new SimWorker();
    workerRef.current = w;

    w.onmessage = (e: MessageEvent<SimResponse>) => {
      // Drop stale messages from a prior run (Play Again / Reset /
      // Pause+Resume races). Reads `gidRef.current` live — never close
      // over `gid` from React state — so the filter sees the latest
      // run id even after this handler was bound on an earlier render.
      // Review Fixlist §11.
      const msg = handleWorkerMessage(gidRef.current, e.data);
      if (!msg) return;
      switch (msg.type) {
        case 'event': {
          setPlayByPlay(prev => [...prev, msg.event]);
          setQuarter(msg.state.quarter);
          setClock(msg.state.clock);
          setScores(msg.state.scores);
          setDown(msg.state.down);
          setToGo(msg.state.toGo);
          setScrimmage(msg.state.scrimmage);
          setPossession(msg.state.possession);
          setIsOvertime(msg.state.isOvertime);
          break;
        }
        case 'done': {
          setFinalResult(msg.result);
          setPlayByPlay(msg.playByPlay);
          setGameState('complete');
          if (onComplete) {
            onComplete({
              ...msg.result,
              playByPlay: msg.playByPlay,
            });
          }
          break;
        }
        case 'error': {
          setError(msg.message);
          setGameState('paused');
          break;
        }
        case 'ack':
          break;
      }
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, [onComplete]);

  const startGame = useCallback(() => {
    if (!workerRef.current) return;
    const gid = Date.now();
    gidRef.current = gid;

    const homeSim = engine.convertTeamToGameSim(homeTeam, homePlayers);
    const awaySim = engine.convertTeamToGameSim(awayTeam, awayPlayers);

    setPlayByPlay([]);
    setScores([0, 0]);
    setQuarter(1);
    setClock(15);
    setIsOvertime(false);
    setError(null);
    setGameState('playing');

    post({
      type: 'simulate',
      gid,
      teams: [homeSim, awaySim],
      season: engine.getState().season,
      playoffs: false,
      speed,
      quarterLength: 15,
      numPeriods: 4,
    });
  }, [engine, homeTeam, awayTeam, homePlayers, awayPlayers, speed, post]);

  const pauseGame = useCallback(() => {
    setGameState('paused');
    post({ type: 'pause', gid: gidRef.current });
  }, [post]);

  const resumeGame = useCallback(() => {
    setGameState('playing');
    post({ type: 'resume', gid: gidRef.current });
  }, [post]);

  const resetGame = useCallback(() => {
    post({ type: 'abort', gid: gidRef.current });
    setGameState('pregame');
    setFinalResult(null);
    setPlayByPlay([]);
    setScores([0, 0]);
    setQuarter(1);
    setClock(15);
    setError(null);
  }, [post]);

  const changeSpeed = useCallback((next: SimSpeed) => {
    setSpeed(next);
    if (gameState === 'playing' || gameState === 'paused') {
      post({ type: 'setSpeed', gid: gidRef.current, speed: next });
    }
  }, [gameState, post]);

  return (
    <div className="game-sim-view">
      <Card className="mb-3">
        <Card.Body className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-1">Game Simulation</h4>
            <p className="text-muted mb-0">
              {homeTeam.name} vs {awayTeam.name}
            </p>
          </div>
          <div className="d-flex gap-2">
            {onBack && (
              <Button variant="outline-secondary" onClick={onBack}>
                ← Back
              </Button>
            )}
            {gameState === 'pregame' && (
              <Button variant="primary" onClick={startGame}>
                ▶ Start Game
              </Button>
            )}
            {gameState === 'playing' && (
              <Button variant="warning" onClick={pauseGame}>
                ⏸ Pause
              </Button>
            )}
            {gameState === 'paused' && (
              <Button variant="success" onClick={resumeGame}>
                ▶ Resume
              </Button>
            )}
            {gameState === 'complete' && (
              <>
                <Button variant="outline-primary" onClick={resetGame}>
                  🔄 Play Again
                </Button>
                {onBack && (
                  <Button variant="primary" onClick={onBack}>
                    ✓ Done
                  </Button>
                )}
              </>
            )}
          </div>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-3" onClose={() => setError(null)} dismissible>
          Simulation error: {error}
        </Alert>
      )}

      {(gameState === 'pregame' || gameState === 'paused' || gameState === 'playing') && (
        <Card className="mb-3">
          <Card.Body className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Simulation Speed:</strong>
            </div>
            <ButtonGroup>
              {(['instant', 'fast', 'normal', 'slow'] as const).map(s => (
                <Button
                  key={s}
                  variant={speed === s ? 'primary' : 'outline-primary'}
                  onClick={() => changeSpeed(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </ButtonGroup>
          </Card.Body>
        </Card>
      )}

      <Scoreboard
        teamNames={teamNames}
        teamColors={teamColors}
        scores={scores}
        quarter={quarter}
        clock={clock}
        down={down}
        toGo={toGo}
        scrimmage={scrimmage}
        isOvertime={isOvertime}
        possession={possession}
      />

      {gameState === 'playing' && (
        <Alert variant="info" className="mb-3">
          <Spinner animation="border" size="sm" className="me-2" />
          Simulating game at {speed} speed (off main thread)...
        </Alert>
      )}

      {gameState === 'paused' && (
        <Alert variant="warning" className="mb-3">
          Game paused. Press Resume to continue.
        </Alert>
      )}

      <Row>
        <Col md={6}>
          <PlayByPlayView
            events={playByPlay}
            teamNames={teamNames}
            isSimulating={gameState === 'playing'}
          />
        </Col>
        <Col md={6}>
          {gameState === 'complete' && finalResult ? (
            <GameStatsView
              teamNames={teamNames}
              teamColors={teamColors}
              teams={[
                finalResult.teams?.[0]?.players || [],
                finalResult.teams?.[1]?.players || [],
              ]}
              teamStats={[
                finalResult.teams?.[0] || {},
                finalResult.teams?.[1] || {},
              ]}
              scores={scores}
            />
          ) : (
            <Card>
              <Card.Header>Live Stats</Card.Header>
              <Card.Body>
                <p className="text-muted">Stats will update during the game...</p>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}

export default GameSimView;
