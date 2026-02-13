import type { Game, Team, Player } from '../../../common/types';
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
  
  constructor({
    gid,
    day,
    teams,
    quarterLength = 15,
    numPeriods = 4,
  }: {
    gid: number;
    day?: number;
    teams: [TeamGameSim, TeamGameSim];
    quarterLength?: number;
    numPeriods?: number;
  }) {
    this.id = gid;
    this.day = day;
    this.team = teams;
    this.quarterLength = quarterLength;
    this.numPeriods = numPeriods;
    this.clock = quarterLength;
    this.playByPlayLogger = new PlayByPlayLogger(true);
    
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
    this.overtimeState = 'initial';
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
    if (this.awaitingKickoff !== undefined) {
      this.doKickoff();
      return;
    }
    
    if (this.awaitingAfterTouchdown) {
      this.doExtraPoint();
      return;
    }
    
    if (this.awaitingAfterSafety) {
      this.doKickoffFromSafety();
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
    const timeRemaining = this.clock + (this.numPeriods - Math.floor(this.clock / this.quarterLength) - 1) * this.quarterLength;
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
    const passRushers = this.getPlayers(this.d, ['DL', 'LB']).slice(0, 4);
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
      
      if (defensivePenalty && defensivePenalty.info.type === 'defensivePassInterference') {
        defensivePenalty.spotYards = Math.round(truncGauss(15, 5, 5, 40));
        this.processPenalty(defensivePenalty, defensivePenalty.spotYards, false);
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

  doKickoffFromSafety(): void {
    this.scrimmage = 20;
    this.doKickoff();
    this.awaitingAfterSafety = false;
  }

  scoreTouchdown(): void {
    this.team[this.o].stat.pts += 6;
    this.awaitingAfterTouchdown = true;
    this.isClockRunning = false;
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
    const players = this.team[team].player.filter(p => p.pos === pos);
    return players[0] || this.team[team].player[0];
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

  finalizeGame(): Game {
    const game: Game = {
      gid: this.id,
      season: 2025,
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
