import type { Game, Team, Player } from '../../../common/entities';
import type { TeamNum, PlayerGameSim, TeamGameSim, PlayEvent } from './types';
import { calculateCompositeRatings } from '../player/ovr';
import { choice, randInt, truncGauss, bound } from '../../../common/random';
import {
  SCRIMMAGE_KICKOFF,
  SCRIMMAGE_TOUCHBACK,
  SCRIMMAGE_EXTRA_POINT,
  FIELD_GOAL_DISTANCE_ADDED,
  NUM_DOWNS,
  STARTING_TIMEOUTS,
} from './types';
import PlayByPlayLogger, { type PlayByPlayEventInput } from './PlayByPlayLogger';
import {
  generateRandomPenalty,
  shouldAcceptPenalty,
  applyPenalty,
  type GamePenalty,
} from './penalties';
import { generateInjury, type PlayerInjury } from './injuries';
import type { StatsManager } from '../stats/StatsManager';
import type { PlayerGameStats } from '@common/stats';
import {
  DEFAULT_PLAYER_GAME_STATS,
  calculatePasserRating,
} from '@common/stats';

export class GameSim {
  id: number;
  day?: number;
  team: [TeamGameSim, TeamGameSim];
  o: TeamNum = 0;
  d: TeamNum = 1;
  clock: number;
  numPeriods: number;
  isClockRunning = false;
  quarterLength: number;
  quarter = 1;
  
  scrimmage = SCRIMMAGE_KICKOFF;
  down = 1;
  toGo = 10;
  
  timeouts: [number, number] = [STARTING_TIMEOUTS, STARTING_TIMEOUTS];
  
  awaitingAfterTouchdown = false;
  awaitingAfterSafety = false;
  awaitingKickoff: TeamNum | undefined;
  
  overtimeState?: 'initial' | 'firstPossession' | 'secondPossession' | 'over';
  overtimes = 0;
  maxOvertimes = 1;
  
  playByPlayLogger: PlayByPlayLogger;
  playUntimedPossession = false;
  
  penalties: GamePenalty[] = [];
  injuries: { player: PlayerGameSim; injury: PlayerInjury }[] = [];
  teamPenalties: [number, number] = [0, 0];

  statsManager?: StatsManager;
  playoffs: boolean = false;
  season: number = 2025;

  /**
   * Streaming sink — set by callers (e.g. the Web Worker bridge) to receive
   * every play-by-play event as it is generated. Setting this also wires
   * the underlying logger so events flow without a buffering step.
   */
  private _onEvent?: (event: import('./PlayByPlayLogger').PlayByPlayEvent) => void;
  get onEvent() {
    return this._onEvent;
  }
  set onEvent(cb: ((event: import('./PlayByPlayLogger').PlayByPlayEvent) => void) | undefined) {
    this._onEvent = cb;
    this.playByPlayLogger.onEvent = cb;
  }

  constructor({
    gid,
    day,
    teams,
    quarterLength = 15,
    numPeriods = 4,
    statsManager,
    playoffs = false,
    season = 2025,
  }: {
    gid: number;
    day?: number;
    teams: [TeamGameSim, TeamGameSim];
    quarterLength?: number;
    numPeriods?: number;
    statsManager?: StatsManager;
    playoffs?: boolean;
    season?: number;
  }) {
    this.id = gid;
    this.day = day;
    this.team = teams;
    this.quarterLength = quarterLength;
    this.numPeriods = numPeriods;
    this.clock = quarterLength;
    this.playByPlayLogger = new PlayByPlayLogger(true);
    this.statsManager = statsManager;
    this.playoffs = playoffs;
    this.season = season;

    this.awaitingKickoff = Math.random() < 0.5 ? 0 : 1;
    this.d = this.awaitingKickoff;
    this.o = this.awaitingKickoff === 0 ? 1 : 0;
  }

  run(): Game {
    this.playByPlayLogger.logEvent({
      type: 'quarter',
      clock: this.clock,
      quarter: 1,
    });
    
    this.simRegulation();
    
    while (
      this.team[0].stat.pts === this.team[1].stat.pts &&
      this.overtimes < this.maxOvertimes
    ) {
      this.simOvertime();
      this.overtimes++;
    }
    
    this.playByPlayLogger.logEvent({
      type: 'gameOver',
      clock: 0,
      final: true,
    });

    // Record stats to StatsManager before finalizing
    this.recordStatsToManager();

    return this.finalizeGame();
  }

  simRegulation(): void {
    for (let q = 1; q <= this.numPeriods; q++) {
      this.quarter = q;
      this.clock = this.quarterLength;
      
      while (this.clock > 0 || this.playUntimedPossession) {
        this.simPlay();
      }
      
      if (q < this.numPeriods) {
        this.playByPlayLogger.logEvent({
          type: 'quarter',
          clock: 0,
          quarter: q + 1,
        });
      }
    }
  }

  simOvertime(): void {
    this.overtimeState = 'initial' as typeof this.overtimeState;
    this.clock = 10;
    this.quarter = this.numPeriods + this.overtimes + 1;
    
    this.playByPlayLogger.logEvent({
      type: 'overtime',
      clock: this.clock,
      overtimeNum: this.overtimes + 1,
    });
    
    while (this.clock > 0 && this.overtimeState !== 'over') {
      this.simPlay();
    }
  }

  simPlay(): void {
    if (this.awaitingAfterSafety) {
      this.doKickoffFromSafety();
      return;
    }

    if (this.awaitingAfterTouchdown) {
      this.doExtraPoint();
      return;
    }

    if (this.awaitingKickoff !== undefined) {
      this.doKickoff();
      return;
    }
    
    const playType = this.selectPlayType();
    
    switch (playType) {
      case 'pass':
        this.doPass();
        break;
      case 'run':
        this.doRun();
        break;
      case 'fieldGoal':
        this.doFieldGoal();
        break;
      case 'punt':
        this.doPunt();
        break;
      case 'kneel':
        this.doKneel();
        break;
    }
    
    this.checkGameEnd();
  }

  selectPlayType(): 'pass' | 'run' | 'fieldGoal' | 'punt' | 'kneel' {
    const scoreDiff = this.team[this.o].stat.pts - this.team[this.d].stat.pts;
    const timeRemaining = computeTimeRemaining({
      clock: this.clock,
      quarter: this.quarter,
      numPeriods: this.numPeriods,
      quarterLength: this.quarterLength,
    });
    const fieldPosition = this.scrimmage;
    const distance = this.toGo;
    const down = this.down;
    
    if (timeRemaining < 2 && scoreDiff > 0) {
      return 'kneel';
    }
    
    if (down === 4) {
      if (fieldPosition > 65) {
        return 'fieldGoal';
      }
      if (fieldPosition < 45 || (scoreDiff < 0 && timeRemaining < 5)) {
        return distance <= 2 ? (Math.random() < 0.6 ? 'run' : 'pass') : 'punt';
      }
    }
    
    if (down <= 2 && distance <= 3) {
      return Math.random() < 0.7 ? 'run' : 'pass';
    }
    
    if (distance > 8) {
      return Math.random() < 0.75 ? 'pass' : 'run';
    }
    
    return Math.random() < 0.55 ? 'pass' : 'run';
  }

  doPass(): void {
    const qb = this.getPlayer(this.o, 'QB');
    let passRushers = this.getPlayers(this.d, ['DL', 'LB']).slice(0, 4);
    // If the defense has no traditional pass rushers (e.g. a malformed roster
    // or an injury-decimated unit), fall back to whatever defenders we have so
    // `passRushComposite` doesn't divide by zero and poison sackProb with NaN.
    if (passRushers.length === 0) {
      passRushers = this.team[this.d].player.slice(0, 4);
    }
    const defenders = this.getPlayers(this.d, ['CB', 'S', 'LB']);
    
    const passBlockers = this.getPlayers(this.o, ['OL', 'TE', 'RB']).slice(0, 6);
    const receivers = this.getPlayers(this.o, ['WR', 'TE', 'RB']).filter(p => p.pos !== 'QB');
    
    const target = choice(receivers);
    
    const offensivePenalty = this.checkForPenalty(true, choice(passBlockers));
    if (offensivePenalty && offensivePenalty.info.isDeadBall) {
      this.processPenalty(offensivePenalty, 0, false);
      return;
    }
    
    const defensivePenalty = this.checkForPenalty(false, choice(defenders));
    if (defensivePenalty && defensivePenalty.info.isDeadBall) {
      this.processPenalty(defensivePenalty, 0, false);
      return;
    }
    
    const passRushComposite = passRushers.reduce((sum, p) => sum + p.compositeRating.passRushing, 0) / passRushers.length;
    const passBlockComposite = passBlockers.reduce((sum, p) => sum + p.compositeRating.passBlocking, 0) / passBlockers.length;
    
    const sackProb = bound(0.02 + (passRushComposite - passBlockComposite) * 0.03, 0.01, 0.15);
    
    if (Math.random() < sackProb) {
      const tackler = choice(passRushers);
      const sackYds = -truncGauss(7, 3, 1, 15);
      const safety = this.scrimmage + sackYds <= 0;
      
      this.playByPlayLogger.logEvent({
        type: 'sack',
        clock: this.clock,
        names: [qb.name, tackler.name],
        t: this.o,
        yds: sackYds,
        safety,
      });
      this.playByPlayLogger.logClock({
        down: this.down,
        toGo: this.toGo,
        scrimmage: this.scrimmage,
        t: this.o,
      });
      
      this.updateState(sackYds);
      this.recordStat(this.o, qb, 'pssSk');
      this.recordStat(this.o, qb, 'pssSkYds', Math.abs(sackYds));
      this.recordStat(this.d, tackler, 'defSk');
      
      this.checkForInjury(qb);
      this.checkForInjury(tackler);
      
      if (safety) {
        this.scoreSafety();
      }
      return;
    }
    
    const qbAccuracy = qb.compositeRating.passingAccuracy;
    const targetGettingOpen = target.compositeRating.gettingOpen;
    const coverage = defenders.reduce((sum, p) => sum + p.compositeRating.passCoverage, 0) / defenders.length;
    
    const completionProb = bound(0.5 + (qbAccuracy - coverage) * 0.01, 0.35, 0.75);
    
    if (Math.random() > completionProb) {
      const defender = Math.random() < 0.3 ? choice(defenders) : undefined;
      
      if (defensivePenalty && defensivePenalty.type === 'defensivePassInterference') {
        defensivePenalty.spotYards = Math.round(truncGauss(15, 5, 5, 40));
        this.processPenalty(defensivePenalty, defensivePenalty.spotYards, false);
        return;
      }

      // Interception: rolled inside the "not a completion" branch so the
      // odds compose with completionProb the way real INTs do (a tighter
      // coverage gap raises both incompletion *and* INT chances). Picked
      // here rather than at the top of doPass to keep the existing
      // sack/penalty random-call ordering intact for tests that pin
      // Math.random() to a single value.
      const intProb = bound(0.05 + (coverage - qbAccuracy) * 0.005, 0.01, 0.10);
      if (Math.random() < intProb) {
        const interceptor =
          (defenders.length > 0 ? choice(defenders) : undefined) ??
          this.team[this.d].player[0];
        const returnYds = Math.round(truncGauss(8, 6, 0, 100));

        this.recordStat(this.o, qb, 'pss');
        this.recordStat(this.o, qb, 'pssInt');
        this.recordStat(this.o, target, 'tgt');
        this.recordStat(this.d, interceptor, 'defInt');
        this.recordStat(this.d, interceptor, 'defIntYds', returnYds);

        // Pick-six probability: 10% baseline, lightly modulated by the
        // returner's straight-line speed. Capped narrow (3-20%) so a
        // single elite defender can't dominate the season-leader board.
        const spdAdj = ((interceptor.spd ?? 50) - 50) * 0.005;
        const pickSixProb = bound(0.10 + spdAdj, 0.03, 0.20);
        const isPickSix = Math.random() < pickSixProb;

        this.playByPlayLogger.logEvent({
          type: 'interception',
          clock: this.clock,
          names: [qb.name, interceptor.name],
          t: this.d,
          td: isPickSix,
          yds: returnYds,
        });
        this.playByPlayLogger.logClock({
          down: this.down,
          toGo: this.toGo,
          scrimmage: this.scrimmage,
          t: this.o,
        });

        if (isPickSix) {
          this.recordStat(this.d, interceptor, 'defIntTD');
          this.playByPlayLogger.logEvent({
            type: 'pickSix',
            clock: this.clock,
            names: [interceptor.name],
            pid: interceptor.pid,
            t: this.d,
            yds: returnYds,
          });
          this.scoreDefensiveTouchdown(interceptor);
        } else {
          this.possessionChange();
        }
        return;
      }

      this.playByPlayLogger.logEvent({
        type: 'passIncomplete',
        clock: this.clock,
        names: [qb.name],
        t: this.o,
      });
      this.playByPlayLogger.logClock({
        down: this.down,
        toGo: this.toGo,
        scrimmage: this.scrimmage,
        t: this.o,
      });
      
      this.recordStat(this.o, qb, 'pss');
      this.recordStat(this.o, target, 'tgt');
      
      this.down++;
      this.isClockRunning = false;
      if (this.down > NUM_DOWNS) {
        this.playByPlayLogger.logEvent({
          type: 'turnoverOnDowns',
          clock: this.clock,
          t: this.d,
        });
        this.possessionChange();
      }
      return;
    }
    
    const yac = truncGauss(5 + (target.compositeRating.rushing - 50) * 0.1, 5, 0, 30);
    const airYds = truncGauss(8 + (qb.compositeRating.passingDeep - 50) * 0.15, 6, 0, 40);
    const totalYds = Math.round(airYds + yac);
    
    this.updateState(totalYds);
    const td = this.scrimmage >= 100;
    const safety = this.scrimmage <= 0;
    
    this.playByPlayLogger.logEvent({
      type: 'pass',
      clock: this.clock,
      names: [qb.name, target.name],
      t: this.o,
      yds: totalYds,
      td,
      safety,
    });
    this.playByPlayLogger.logClock({
      down: this.down,
      toGo: this.toGo,
      scrimmage: this.scrimmage,
      t: this.o,
    });
    
    this.recordStat(this.o, qb, 'pss');
    this.recordStat(this.o, qb, 'pssCmp');
    this.recordStat(this.o, qb, 'pssYds', totalYds);
    this.recordStat(this.o, target, 'tgt');
    this.recordStat(this.o, target, 'rec');
    this.recordStat(this.o, target, 'recYds', totalYds);
    
    this.checkForInjury(target);
    
    if (td) {
      this.recordStat(this.o, qb, 'pssTD');
      this.recordStat(this.o, target, 'recTD');
      this.scoreTouchdown();
    } else if (safety) {
      this.scoreSafety();
    }
  }

  doRun(): void {
    const rb = this.getPlayer(this.o, 'RB') || this.getPlayer(this.o, 'QB');
    const oLine = this.getPlayers(this.o, ['OL', 'TE']);
    const dLine = this.getPlayers(this.d, ['DL', 'LB']);
    
    const offensivePenalty = this.checkForPenalty(true, choice(oLine));
    if (offensivePenalty && offensivePenalty.info.isDeadBall) {
      this.processPenalty(offensivePenalty, 0, false);
      return;
    }
    
    const runBlockComposite = oLine.reduce((sum, p) => sum + p.compositeRating.runBlocking, 0) / oLine.length;
    const runStopComposite = dLine.reduce((sum, p) => sum + p.compositeRating.runStopping, 0) / dLine.length;
    
    const baseYds = truncGauss(4 + (runBlockComposite - runStopComposite) * 0.08, 4, -5, 25);
    const rbBonus = (rb.compositeRating.rushing - 50) * 0.1;
    const yds = Math.round(baseYds + rbBonus);

    // Fumble check happens BEFORE updateState so the random calls used
    // by `updateState`'s clock-stochastics don't shift the sequence the
    // tests pin (and so we never advance the down on a play that ends in
    // a turnover anyway). `ballSecurity` lightly trims the rate for
    // sure-handed RBs; bound keeps the rate in a realistic 0.5-4% band.
    const ballSec = rb.compositeRating.ballSecurity ?? 50;
    const fumbleProb = bound(0.015 - (ballSec - 50) * 0.0005, 0.005, 0.04);
    if (Math.random() < fumbleProb) {
      // Credit the rusher with the yards he picked up before coughing it
      // up — matches NFL bookkeeping (rushing yards count even on a
      // fumble that's recovered by the defense).
      this.scrimmage += yds;
      this.recordStat(this.o, rb, 'rus');
      this.recordStat(this.o, rb, 'rusYds', yds);
      this.recordStat(this.o, rb, 'rusFmb');

      const recoverers = this.getPlayers(this.d, ['DL', 'LB', 'CB', 'S']);
      const recoverer =
        (recoverers.length > 0 ? choice(recoverers) : undefined) ??
        this.team[this.d].player[0];
      const returnYds = Math.round(truncGauss(5, 5, 0, 80));

      this.recordStat(this.d, recoverer, 'defFf');
      this.recordStat(this.d, recoverer, 'defFr');

      // Fumble-six baseline 8% (lower than pickSix because most fumbles
      // are recovered in a pile, not in space). Same speed-tilt as
      // pick-six but capped tighter.
      const spdAdj = ((recoverer.spd ?? 50) - 50) * 0.005;
      const fumbleSixProb = bound(0.08 + spdAdj, 0.02, 0.18);
      const isFumbleSix = Math.random() < fumbleSixProb;

      this.playByPlayLogger.logEvent({
        type: 'fumble',
        clock: this.clock,
        names: [rb.name, recoverer.name],
        t: this.d,
        td: isFumbleSix,
        yds: returnYds,
      });
      this.playByPlayLogger.logClock({
        down: this.down,
        toGo: this.toGo,
        scrimmage: this.scrimmage,
        t: this.o,
      });

      if (isFumbleSix) {
        this.recordStat(this.d, recoverer, 'defFrTD');
        this.playByPlayLogger.logEvent({
          type: 'fumbleSix',
          clock: this.clock,
          names: [recoverer.name],
          pid: recoverer.pid,
          t: this.d,
          yds: returnYds,
        });
        this.scoreDefensiveTouchdown(recoverer);
      } else {
        this.possessionChange();
      }
      return;
    }

    this.updateState(yds);
    const td = this.scrimmage >= 100;
    const safety = this.scrimmage <= 0;
    
    this.playByPlayLogger.logEvent({
      type: 'run',
      clock: this.clock,
      names: [rb.name],
      t: this.o,
      yds,
      td,
      safety,
    });
    this.playByPlayLogger.logClock({
      down: this.down,
      toGo: this.toGo,
      scrimmage: this.scrimmage,
      t: this.o,
    });
    
    this.recordStat(this.o, rb, 'rus');
    this.recordStat(this.o, rb, 'rusYds', yds);
    
    this.checkForInjury(rb);
    
    if (td) {
      this.recordStat(this.o, rb, 'rusTD');
      this.scoreTouchdown();
    } else if (safety) {
      this.scoreSafety();
    }
  }

  doFieldGoal(): void {
    const kicker = this.getPlayer(this.o, 'K');
    const distance = Math.round(100 - this.scrimmage + FIELD_GOAL_DISTANCE_ADDED);
    
    const baseProb = 0.95 - (distance - 20) * 0.015;
    const kickerBonus = (kicker.compositeRating.kpw + kicker.compositeRating.kac - 100) * 0.002;
    const makeProb = bound(baseProb + kickerBonus, 0.1, 0.98);
    
    const made = Math.random() < makeProb;
    
    this.playByPlayLogger.logEvent({
      type: 'fieldGoal',
      clock: this.clock,
      made,
      names: [kicker.name],
      t: this.o,
      yds: distance,
    });
    this.playByPlayLogger.logClock({
      down: this.down,
      toGo: this.toGo,
      scrimmage: this.scrimmage,
      t: this.o,
    });
    
    this.recordStat(this.o, kicker, 'fga');
    
    if (made) {
      this.recordStat(this.o, kicker, 'fg');
      this.recordStat(this.o, kicker, 'fgLng', distance);
      this.team[this.o].stat.pts += 3;
      this.awaitingKickoff = this.o;
    } else {
      this.possessionChange();
    }
  }

  doPunt(): void {
    const punter = this.getPlayer(this.o, 'P');
    const distance = truncGauss(42 + (punter.compositeRating.ppw - 50) * 0.2, 5, 30, 65);
    
    this.scrimmage += Math.round(distance);
    const touchback = this.scrimmage >= 100;
    
    this.playByPlayLogger.logEvent({
      type: 'punt',
      clock: this.clock,
      names: [punter.name],
      t: this.o,
      yds: Math.round(distance),
      touchback,
    });
    this.playByPlayLogger.logClock({
      down: this.down,
      toGo: this.toGo,
      scrimmage: this.scrimmage,
      t: this.o,
    });
    
    this.recordStat(this.o, punter, 'pnt');
    this.recordStat(this.o, punter, 'pntYds', Math.round(distance));
    
    if (touchback) {
      this.scrimmage = SCRIMMAGE_TOUCHBACK;
    }
    
    this.possessionChange();
  }

  doKneel(): void {
    const qb = this.getPlayer(this.o, 'QB');
    
    this.playByPlayLogger.logEvent({
      type: 'kneel',
      clock: this.clock,
      names: [qb.name],
      t: this.o,
      yds: -1,
    });
    this.playByPlayLogger.logClock({
      down: this.down,
      toGo: this.toGo,
      scrimmage: this.scrimmage,
      t: this.o,
    });
    
    this.recordStat(this.o, qb, 'rus');
    this.recordStat(this.o, qb, 'rusYds', -1);
    
    this.updateState(-1);
  }

  doKickoff(): void {
    const kicker = this.getPlayer(this.awaitingKickoff!, 'K');
    const kickYds = truncGauss(62 + (kicker.compositeRating.kpw - 50) * 0.15, 5, 50, 75);
    const kickTo = Math.round(100 - kickYds);
    
    this.recordStat(this.awaitingKickoff!, kicker, 'ko');
    this.recordStat(this.awaitingKickoff!, kicker, 'koYds', kickYds);
    
    if (kickTo <= 0) {
      this.scrimmage = SCRIMMAGE_TOUCHBACK;
      this.playByPlayLogger.logEvent({
        type: 'kickoff',
        clock: this.clock,
        names: [kicker.name],
        t: this.awaitingKickoff!,
        yds: kickYds,
        touchback: true,
      });
      this.possessionChange();
    } else {
      this.playByPlayLogger.logEvent({
        type: 'kickoff',
        clock: this.clock,
        names: [kicker.name],
        t: this.awaitingKickoff!,
        yds: kickYds,
        touchback: false,
      });
      this.doKickReturn(kickTo);
    }
  }

  doKickReturn(kickTo: number): void {
    const returner = this.getPlayer(this.o, 'KR') || this.getPlayer(this.o, 'RB');
    const coverageTeam = this.getPlayers(this.d, ['S', 'CB', 'LB']);
    
    const returnYds = truncGauss(20 + (returner.compositeRating.rushing - 50) * 0.3, 8, -5, 100);
    const finalYds = Math.round(bound(returnYds, -5, kickTo));
    
    this.scrimmage = kickTo - finalYds;
    const td = this.scrimmage <= 0;
    
    this.playByPlayLogger.logEvent({
      type: 'kickoffReturn',
      clock: this.clock,
      names: [returner.name],
      t: this.o,
      td,
      yds: finalYds,
    });
    this.playByPlayLogger.logClock({
      down: 1,
      toGo: 10,
      scrimmage: td ? 20 : this.scrimmage,
      t: this.o,
    });
    
    this.recordStat(this.o, returner, 'kr');
    this.recordStat(this.o, returner, 'krYds', finalYds);
    
    if (td) {
      this.scrimmage = 0;
      this.recordStat(this.o, returner, 'krTD');
      this.scoreTouchdown();
    } else {
      this.newFirstDown();
    }
    
    this.awaitingKickoff = undefined;
  }

  doExtraPoint(): void {
    // After a TD the offence picks XP vs 2PT. Routing happens here (rather
    // than in simPlay) so any future call site that wants "the post-TD play"
    // gets the AI's choice for free without re-implementing the dispatch.
    if (this.decideXpOrTwo() === 'two') {
      this.doTwoPointConversion();
      return;
    }

    const kicker = this.getPlayer(this.o, 'K');
    const distance = 100 - SCRIMMAGE_EXTRA_POINT + FIELD_GOAL_DISTANCE_ADDED;
    
    const makeProb = bound(0.94 + (kicker.compositeRating.kac - 50) * 0.001, 0.85, 0.995);
    const made = Math.random() < makeProb;
    
    this.playByPlayLogger.logEvent({
      type: 'extraPoint',
      clock: this.clock,
      made,
      names: [kicker.name],
      t: this.o,
    });
    
    this.recordStat(this.o, kicker, 'xpa');
    
    if (made) {
      this.recordStat(this.o, kicker, 'xp');
      this.team[this.o].stat.pts += 1;
    }
    
    this.awaitingAfterTouchdown = false;
    this.awaitingKickoff = this.o;
  }

  /**
   * Decide whether to attempt a 2-point conversion or kick the extra point
   * after a touchdown. Pure situational AI — only reads `this.quarter`,
   * `this.clock`, and the two team scores, so there are no hidden coupling
   * points with the rest of the simulation (penalties, injuries, etc.).
   *
   * Heuristic, intentionally simple:
   *   1. Late 4Q (any clock) when the scoring team is exactly down by 2:
   *      tying the game in regulation is the canonical 2PT spot, so go
   *      for it ~90% of the time. The 10% reserve avoids being fully
   *      deterministic in this branch.
   *   2. Late 4Q (clock < 5 minutes) when the scoring team trails by a
   *      margin where 2 points changes the win/loss math (-1, -5, -8,
   *      -10, -12): ~60% chance.
   *   3. Otherwise (early game, comfortable lead, etc.): 5% baseline so
   *      season totals still surface occasional 2PT attempts.
   *
   * The decision runs AFTER scoreTouchdown() has bumped `pts` by 6, so
   * `scoreDiff` here reflects the post-TD scoreboard.
   */
  decideXpOrTwo(): 'xp' | 'two' {
    const scoreDiff = this.team[this.o].stat.pts - this.team[this.d].stat.pts;
    const isFourthQuarter = this.quarter === this.numPeriods;
    const lateInGame = isFourthQuarter && this.clock < 5;
    // Margins where converting two points materially changes the outcome
    // (tie, one-score game, two-possession game). Down-by-1 is included
    // because XP makes it tie; 2PT makes it a one-point lead in regulation.
    const goForTwoMargins = new Set([-1, -5, -8, -10, -12]);

    if (isFourthQuarter && scoreDiff === -2) {
      return Math.random() < 0.9 ? 'two' : 'xp';
    }
    if (lateInGame && goForTwoMargins.has(scoreDiff)) {
      return Math.random() < 0.6 ? 'two' : 'xp';
    }
    return Math.random() < 0.05 ? 'two' : 'xp';
  }

  /**
   * Single-snap 2-point conversion from the 2-yard line. Picks a pass or
   * run with equal probability. Success rate is fixed at ~48% — the NFL
   * 2003-2023 historical average — and is deliberately play-type-agnostic
   * to avoid coupling to the heavier doPass / doRun implementations
   * (penalty, sack and injury machinery are all inappropriate for a
   * single conversion attempt).
   *
   * Both branches finish the after-TD state machine identically to a
   * completed XP: clear `awaitingAfterTouchdown` and queue the scoring
   * team's kickoff. Skipping either of those would deadlock the loop in
   * `simPlay()`, which is the bug B2 fixed for the XP path.
   */
  doTwoPointConversion(): void {
    const playType: 'pass' | 'run' = Math.random() < 0.5 ? 'pass' : 'run';
    const success = Math.random() < 0.48;
    const player = playType === 'pass'
      ? this.getPlayer(this.o, 'QB')
      : (this.getPlayer(this.o, 'RB') || this.getPlayer(this.o, 'QB'));

    this.playByPlayLogger.logEvent({
      type: 'twoPointConversion',
      clock: this.clock,
      names: [player.name],
      t: this.o,
      success,
      playType,
    });

    if (success) {
      this.team[this.o].stat.pts += 2;
    }

    this.awaitingAfterTouchdown = false;
    this.awaitingKickoff = this.o;
  }

  doKickoffFromSafety(): void {
    this.scrimmage = 20;
    this.doKickoff();
    this.awaitingAfterSafety = false;
  }

  scoreTouchdown(): void {
    this.team[this.o].stat.pts += 6;
    this.awaitingAfterTouchdown = true;
    this.isClockRunning = false;
    if (this.overtimeState !== undefined) {
      this.overtimeState = 'over';
    }
  }

  /**
   * Score a touchdown for the *defending* team — called from the pick-six /
   * fumble-six branches of doPass / doRun. The contract is: caller has
   * already recorded the turnover stats on the (still-current) defender,
   * and we are responsible for flipping possession so the returning team
   * becomes the new offense for the upcoming XP/2PT attempt.
   *
   * Why flip BEFORE calling scoreTouchdown:
   *   - `scoreTouchdown()` adds 6 to `this.team[this.o]`, so the
   *     defending-team-becomes-offense flip must happen first or we'd
   *     credit the points to the team that just turned the ball over.
   *   - `awaitingAfterTouchdown = true` then routes the next play
   *     through `doExtraPoint`, which kicks for `this.o`. After the
   *     flip, `this.o` is the returning team — exactly the unit that
   *     should be lining up for the XP. This mirrors the standard
   *     post-TD state machine fixed in B2/C2.
   */
  scoreDefensiveTouchdown(_returner: PlayerGameSim): void {
    [this.o, this.d] = [this.d, this.o];
    this.scoreTouchdown();
  }

  scoreSafety(): void {
    this.team[this.d].stat.pts += 2;
    this.awaitingAfterSafety = true;
    this.isClockRunning = false;
    this.awaitingKickoff = this.o;
  }

  updateState(yds: number): void {
    this.scrimmage += yds;
    this.toGo -= yds;
    
    if (this.scrimmage >= 100 || this.scrimmage <= 0) {
      return;
    }
    
    if (this.toGo <= 0) {
      this.newFirstDown();
    } else {
      this.down++;
      if (this.down > NUM_DOWNS) {
        this.playByPlayLogger.logEvent({
          type: 'turnoverOnDowns',
          clock: this.clock,
          t: this.d,
        });
        this.possessionChange();
      }
    }
    
    this.isClockRunning = Math.random() < 0.85;
    if (this.isClockRunning) {
      this.clock = Math.max(0, this.clock - (30 + Math.random() * 15) / 60);
    }
  }

  newFirstDown(): void {
    this.down = 1;
    if (isNaN(this.scrimmage)) {
      this.scrimmage = 20;
    }
    this.toGo = Math.min(10, 100 - this.scrimmage);
  }

  possessionChange(): void {
    if (isNaN(this.scrimmage)) {
      this.scrimmage = 20;
    }
    this.scrimmage = 100 - this.scrimmage;
    [this.o, this.d] = [this.d, this.o];
    this.newFirstDown();
    this.isClockRunning = false;
  }

  checkGameEnd(): void {
    if (this.clock <= 0 && !this.playUntimedPossession) {
      return;
    }
  }

  getPlayer(team: TeamNum, pos: string): PlayerGameSim {
    const t = this.team[team];
    if (!t) {
      throw new Error(
        `getPlayer called with invalid team ${team} (o=${this.o}, d=${this.d}, awaitingKickoff=${this.awaitingKickoff}, awaitingAfterSafety=${this.awaitingAfterSafety})`,
      );
    }
    const players = t.player.filter(p => p.pos === pos);
    return players[0] || t.player[0];
  }

  getPlayers(team: TeamNum, positions: string[]): PlayerGameSim[] {
    return this.team[team].player.filter(p => positions.includes(p.pos));
  }

  recordStat(team: TeamNum, player: PlayerGameSim | undefined, stat: string, value: number = 1): void {
    if (!player) return;
    
    if (!player.stat[stat]) {
      player.stat[stat] = 0;
    }
    player.stat[stat] += value;
    
    if (!this.team[team].stat[stat]) {
      this.team[team].stat[stat] = 0;
    }
    this.team[team].stat[stat] += value;
  }

  checkForPenalty(isOffense: boolean, player: PlayerGameSim | undefined): GamePenalty | null {
    if (!player) return null;
    return generateRandomPenalty(isOffense, player, isOffense ? this.o : this.d);
  }

  processPenalty(penalty: GamePenalty, resultYards: number, isScoringPlay: boolean): void {
    penalty.accepted = shouldAcceptPenalty(
      penalty,
      this.scrimmage,
      this.down,
      this.toGo,
      resultYards,
      isScoringPlay
    );
    
    this.penalties.push(penalty);
    this.teamPenalties[penalty.team]++;
    
    if (penalty.accepted) {
      const penaltyTeam = penalty.team as TeamNum;
      const { newScrimmage, newToGo, firstDown } = applyPenalty(
        penalty,
        this.scrimmage,
        this.toGo
      );
      
      this.scrimmage = newScrimmage;
      this.toGo = newToGo;
      
      if (firstDown) {
        this.newFirstDown();
      }
      
      if (penalty.info.isOffensive) {
        this.isClockRunning = false;
      }
    }
    
    this.playByPlayLogger.logEvent({
      type: 'penalty',
      clock: this.clock,
      names: penalty.player ? [penalty.player.name] : ['Unknown'],
      penaltyName: penalty.info.name,
      t: penalty.team,
      yds: penalty.accepted ? penalty.info.yards : 0,
    });
  }

  checkForInjury(player: PlayerGameSim): void {
    const injury = generateInjury(player);
    if (injury) {
      player.injury = injury;
      this.injuries.push({ player, injury });
    }
  }

  getPenaltyStats(): { team0Penalties: number; team0Yards: number; team1Penalties: number; team1Yards: number } {
    let team0Penalties = 0;
    let team0Yards = 0;
    let team1Penalties = 0;
    let team1Yards = 0;

    for (const p of this.penalties) {
      if (p.accepted) {
        if (p.team === 0) {
          team0Penalties++;
          team0Yards += p.info.yards;
        } else {
          team1Penalties++;
          team1Yards += p.info.yards;
        }
      }
    }

    return { team0Penalties, team0Yards, team1Penalties, team1Yards };
  }

  /**
   * Convert player game stats to PlayerGameStats format for StatsManager
   */
  convertPlayerStats(player: PlayerGameSim, tid: number): PlayerGameStats {
    const s = player.stat;
    const stats: PlayerGameStats = {
      ...JSON.parse(JSON.stringify(DEFAULT_PLAYER_GAME_STATS)),
      gp: 1,
      gs: 1, // Assume all players who played started
      pass: {
        att: s.pss ?? 0,
        cmp: s.pssCmp ?? 0,
        inc: (s.pss ?? 0) - (s.pssCmp ?? 0),
        yds: s.pssYds ?? 0,
        ydsAir: 0,
        ydsYAC: 0,
        td: s.pssTD ?? 0,
        int: s.pssInt ?? 0,
        intTD: 0,
        sacked: s.pssSk ?? 0,
        sackedYds: s.pssSkYds ?? 0,
        rate: 0,
        fmb: 0,
        fmbLost: 0,
      },
      rush: {
        att: s.rus ?? 0,
        yds: s.rusYds ?? 0,
        td: s.rusTD ?? 0,
        lng: s.rusLng ?? 0,
        lngTD: false,
        fmb: s.rusFmb ?? 0,
        fmbLost: 0,
        ypc: 0,
        firstDowns: 0,
        brokenTackles: 0,
      },
      recv: {
        tgt: s.tgt ?? 0,
        rec: s.rec ?? 0,
        yds: s.recYds ?? 0,
        ydsAir: 0,
        ydsYAC: 0,
        td: s.recTD ?? 0,
        lng: s.recLng ?? 0,
        lngTD: false,
        fmb: 0,
        fmbLost: 0,
        drops: 0,
        firstDowns: 0,
        ypr: 0,
        ctchPct: 0,
      },
      def: {
        tck: s.defTck ?? 0,
        tckSolo: s.defTckSolo ?? s.defTck ?? 0,
        tckAst: 0,
        tfl: 0,
        tflYds: 0,
        sk: s.defSk ?? 0,
        skYds: s.defSkYds ?? 0,
        qbHit: 0,
        int: s.defInt ?? 0,
        intYds: s.defIntYds ?? 0,
        intTD: s.defIntTD ?? 0,
        ff: s.defFf ?? 0,
        fr: s.defFr ?? 0,
        frYds: 0,
        frTD: 0,
        pd: s.defPd ?? 0,
        blk: 0,
        saf: 0,
      },
      kick: {
        fgAtt: s.fga ?? 0,
        fgMade: s.fg ?? 0,
        fgLng: s.fgLng ?? 0,
        fgBlk: 0,
        xpAtt: s.xpa ?? 0,
        xpMade: s.xp ?? 0,
        ko: s.ko ?? 0,
        koYds: s.koYds ?? 0,
        koTB: s.koTB ?? 0,
        koOOB: 0,
        koOnside: 0,
        koOnsideRec: 0,
      },
      punt: {
        pnt: s.pnt ?? 0,
        yds: s.pntYds ?? 0,
        lng: s.pntLng ?? 0,
        blk: 0,
        in20: 0,
        tb: 0,
        fc: 0,
        net: s.pntYds ?? 0,
      },
      ret: {
        kr: s.kr ?? 0,
        krYds: s.krYds ?? 0,
        krLng: s.krLng ?? 0,
        krTD: s.krTD ?? 0,
        pr: s.pr ?? 0,
        prYds: s.prYds ?? 0,
        prLng: s.prLng ?? 0,
        prTD: s.prTD ?? 0,
        fmb: 0,
      },
      snp: 0,
      pts: (s.pssTD ?? 0) * 6 + (s.rusTD ?? 0) * 6 + (s.recTD ?? 0) * 6 + (s.krTD ?? 0) * 6 + (s.prTD ?? 0) * 6 + (s.fg ?? 0) * 3 + (s.xp ?? 0),
    };

    // Calculate passer rating
    stats.pass.rate = calculatePasserRating(stats.pass);

    // Calculate yards per carry
    stats.rush.ypc = stats.rush.att > 0 ? stats.rush.yds / stats.rush.att : 0;

    // Calculate yards per reception
    stats.recv.ypr = stats.recv.rec > 0 ? stats.recv.yds / stats.recv.rec : 0;

    // Calculate catch percentage
    stats.recv.ctchPct = stats.recv.tgt > 0 ? (stats.recv.rec / stats.recv.tgt) * 100 : 0;

    return stats;
  }

  /**
   * Record all player stats to StatsManager
   */
  recordStatsToManager(): void {
    if (!this.statsManager) return;

    for (let t = 0; t < 2; t++) {
      const tid = this.team[t].id;
      for (const player of this.team[t].player) {
        // Check if player participated (has any stats)
        const hasStats = Object.keys(player.stat).length > 0;
        if (!hasStats) continue;

        // Initialize and record stats
        this.statsManager.initPlayerStats(
          { pid: player.pid, tid } as any,
          this.playoffs
        );

        const gameStats = this.convertPlayerStats(player, tid);
        this.statsManager.recordPlayerGameStats(player.pid, gameStats);
      }
    }
  }

  finalizeGame(): Game {
    const game: Game = {
      gid: this.id,
      // Use the actual game season from construction. The previous
      // hardcoded `2025` made every saved game look like it happened
      // in 2025 regardless of the in-game year, which broke playoff
      // round attribution, season totals, and HOF voting.
      season: this.season,
      day: this.day,
      teams: [
        {
          tid: this.team[0].id,
          players: this.team[0].player,
          pts: this.team[0].stat.pts,
        },
        {
          tid: this.team[1].id,
          players: this.team[1].player,
          pts: this.team[1].stat.pts,
        },
      ] as any,
      overtimes: this.overtimes,
      att: 60000,
    } as Game;
    
    return game;
  }
}

/**
 * Total game minutes left given the current quarter and clock. Pure helper
 * extracted from `selectPlayType` so it can be unit tested without spinning
 * up a full GameSim.
 *
 * The previous in-line formula
 *   `clock + (numPeriods - Math.floor(clock / quarterLength) - 1) * quarterLength`
 * tried to derive elapsed quarters from the clock, which silently produced
 * wrong values whenever `clock <= quarterLength` (always true). The correct
 * derivation uses the explicit `quarter` field. Overtime quarters
 * (`quarter > numPeriods`) clamp to clock-only.
 */
export function computeTimeRemaining(args: {
  clock: number;
  quarter: number;
  numPeriods: number;
  quarterLength: number;
}): number {
  const { clock, quarter, numPeriods, quarterLength } = args;
  const fullPeriodsLeft = Math.max(0, numPeriods - quarter);
  return clock + fullPeriodsLeft * quarterLength;
}
