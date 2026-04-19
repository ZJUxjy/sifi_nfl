import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Button, ButtonGroup, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { getGameEngine } from '../../worker/api';
import type {
  TeamNum,
  PlayByPlayEvent,
  GameSim,
} from '@worker/api/types';
import type { Team, Player } from '@common/entities';
import Scoreboard from './Scoreboard';
import PlayByPlayView from './PlayByPlayView';
import GameStatsView from './GameStatsView';

type SpeedSetting = 'instant' | 'fast' | 'normal' | 'slow';

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
  const [speed, setSpeed] = useState<SpeedSetting>('normal');
  const [quarter, setQuarter] = useState(1);
  const [clock, setClock] = useState(15);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [down, setDown] = useState<number | undefined>(undefined);
  const [toGo, setToGo] = useState<number | undefined>(undefined);
  const [scrimmage, setScrimmage] = useState<number | undefined>(undefined);
  const [possession, setPossession] = useState<TeamNum | undefined>(undefined);
  const [playByPlay, setPlayByPlay] = useState<PlayByPlayEvent[]>([]);
  const [isOvertime, setIsOvertime] = useState(false);

  const [gameSim, setGameSim] = useState<GameSim | null>(null);
  const [finalResult, setFinalResult] = useState<any>(null);

  const simulationRef = useRef<number | null>(null);
  const simulationQueueRef = useRef<PlayByPlayEvent[]>([]);

  const teamNames: [string, string] = [homeTeam.name, awayTeam.name];
  const teamColors: [[string, string, string], [string, string, string]] = [homeTeam.colors, awayTeam.colors];

  const initializeGame = useCallback(() => {
    const game = engine.createGameSim({
      homeTeam,
      awayTeam,
      homePlayers,
      awayPlayers,
      quarterLength: 15,
      numPeriods: 4,
      playoffs: false,
    });

    setGameSim(game);
    setScores([0, 0]);
    setQuarter(1);
    setClock(15);
    setPlayByPlay([]);
    setDown(undefined);
    setToGo(undefined);
    setScrimmage(undefined);
    setIsOvertime(false);
  }, [homeTeam, awayTeam, homePlayers, awayPlayers, engine]);

  // Run simulation loop
  const runSimulationStep = useCallback(() => {
    if (!gameSim || gameState !== 'playing') return;

    const stepsPerFrame: Record<SpeedSetting, number> = {
      instant: 50,
      fast: 10,
      normal: 1,
      slow: 1,
    };

    const delays: Record<SpeedSetting, number> = {
      instant: 0,
      fast: 50,
      normal: 500,
      slow: 1500,
    };

    const steps = stepsPerFrame[speed];
    const delay = delays[speed];

    // Store original playByPlay logger
    const originalEvents = [...gameSim.playByPlayLogger.playByPlay];

    for (let i = 0; i < steps; i++) {
      if (gameSim.clock <= 0 && !gameSim.playUntimedPossession) {
        if (gameSim.quarter < 4) {
          gameSim.quarter++;
          gameSim.clock = 15;
        } else {
          // Game over
          break;
        }
      }

      gameSim.simPlay();
    }

    // Get new events
    const newEvents = gameSim.playByPlayLogger.playByPlay.slice(originalEvents.length);

    // Update state
    setQuarter(gameSim.quarter);
    setClock(gameSim.clock);
    setScores([gameSim.team[0].stat.pts, gameSim.team[1].stat.pts]);
    setDown(gameSim.down);
    setToGo(gameSim.toGo);
    setScrimmage(gameSim.scrimmage);
    setPossession(gameSim.o);
    setIsOvertime(gameSim.overtimes > 0);

    // Add new events to play-by-play
    if (newEvents.length > 0) {
      setPlayByPlay(prev => [...prev, ...newEvents]);
    }

    // Check if game is over
    if (speed === 'instant' && gameSim.clock <= 0 && gameSim.quarter >= 4) {
      // Continue checking for overtime
      while (gameSim.team[0].stat.pts === gameSim.team[1].stat.pts && gameSim.overtimes < gameSim.maxOvertimes) {
        gameSim.simOvertime();
        gameSim.overtimes++;
      }
    }

    const isGameOver = gameSim.clock <= 0 && gameSim.quarter >= 4 &&
      (gameSim.team[0].stat.pts !== gameSim.team[1].stat.pts || gameSim.overtimes >= gameSim.maxOvertimes);

    if (isGameOver) {
      setGameState('complete');
      const result = gameSim.finalizeGame();
      setFinalResult(result);

      if (onComplete) {
        onComplete({
          ...result,
          teams: [
            { ...result.teams[0], players: gameSim.team[0].player },
            { ...result.teams[1], players: gameSim.team[1].player },
          ],
          playByPlay: gameSim.playByPlayLogger.getPlayByPlay(),
          penalties: gameSim.getPenaltyStats(),
          injuries: gameSim.injuries,
        });
      }
      return;
    }

    // Schedule next step
    if (gameState === 'playing') {
      simulationRef.current = window.setTimeout(() => {
        requestAnimationFrame(runSimulationStep);
      }, delay);
    }
  }, [gameSim, gameState, speed, onComplete]);

  // Start game
  const startGame = useCallback(() => {
    if (!gameSim) {
      initializeGame();
    }
    setGameState('playing');
  }, [gameSim, initializeGame]);

  // Pause game
  const pauseGame = useCallback(() => {
    setGameState('paused');
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  // Resume game
  const resumeGame = useCallback(() => {
    setGameState('playing');
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    if (simulationRef.current) {
      clearTimeout(simulationRef.current);
      simulationRef.current = null;
    }
    initializeGame();
    setGameState('pregame');
    setFinalResult(null);
  }, [initializeGame]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearTimeout(simulationRef.current);
      }
    };
  }, []);

  // Run simulation when playing
  useEffect(() => {
    if (gameState === 'playing' && gameSim) {
      runSimulationStep();
    }
    return () => {
      if (simulationRef.current) {
        clearTimeout(simulationRef.current);
      }
    };
  }, [gameState, gameSim, runSimulationStep]);

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

      {/* Speed Control */}
      {gameState === 'pregame' || gameState === 'paused' || gameState === 'playing' ? (
        <Card className="mb-3">
          <Card.Body className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Simulation Speed:</strong>
            </div>
            <ButtonGroup>
              <Button
                variant={speed === 'instant' ? 'primary' : 'outline-primary'}
                onClick={() => setSpeed('instant')}
                disabled={gameState === 'playing'}
              >
                Instant
              </Button>
              <Button
                variant={speed === 'fast' ? 'primary' : 'outline-primary'}
                onClick={() => setSpeed('fast')}
                disabled={gameState === 'playing'}
              >
                Fast
              </Button>
              <Button
                variant={speed === 'normal' ? 'primary' : 'outline-primary'}
                onClick={() => setSpeed('normal')}
                disabled={gameState === 'playing'}
              >
                Normal
              </Button>
              <Button
                variant={speed === 'slow' ? 'primary' : 'outline-primary'}
                onClick={() => setSpeed('slow')}
                disabled={gameState === 'playing'}
              >
                Slow
              </Button>
            </ButtonGroup>
          </Card.Body>
        </Card>
      ) : null}

      {/* Scoreboard */}
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

      {/* Game Status */}
      {gameState === 'playing' && (
        <Alert variant="info" className="mb-3">
          <Spinner animation="border" size="sm" className="me-2" />
          Simulating game at {speed} speed...
        </Alert>
      )}

      {gameState === 'paused' && (
        <Alert variant="warning" className="mb-3">
          Game paused. Press Resume to continue.
        </Alert>
      )}

      <Row>
        <Col md={6}>
          {/* Play by Play */}
          <PlayByPlayView
            events={playByPlay}
            teamNames={teamNames}
            isSimulating={gameState === 'playing'}
          />
        </Col>
        <Col md={6}>
          {/* Game Stats (show when complete or periodically) */}
          {gameState === 'complete' && finalResult ? (
            <GameStatsView
              teamNames={teamNames}
              teamColors={teamColors}
              teams={[gameSim?.team[0].player || [], gameSim?.team[1].player || []]}
              teamStats={[gameSim?.team[0].stat || {}, gameSim?.team[1].stat || {}]}
              scores={scores}
              penalties={gameSim?.getPenaltyStats()}
              injuries={gameSim?.injuries}
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
