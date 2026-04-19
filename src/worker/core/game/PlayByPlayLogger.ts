import type { TeamNum, PlayerGameSim } from './types';

export type ScoringEventInput =
  | {
      type: 'kickoffReturn';
      clock: number;
      names: string[];
      t: TeamNum;
      td: boolean;
      yds: number;
    }
  | {
      type: 'puntReturn';
      clock: number;
      names: string[];
      t: TeamNum;
      td: boolean;
      yds: number;
    }
  | {
      type: 'pass';
      clock: number;
      names: string[];
      safety: boolean;
      t: TeamNum;
      td: boolean;
      yds: number;
    }
  | {
      type: 'run';
      clock: number;
      names: string[];
      safety: boolean;
      t: TeamNum;
      td: boolean;
      yds: number;
    }
  | {
      type: 'fieldGoal';
      clock: number;
      made: boolean;
      names: string[];
      t: TeamNum;
      yds: number;
    }
  | {
      type: 'extraPoint';
      clock: number;
      made: boolean;
      names: string[];
      t: TeamNum;
    }
  | {
      type: 'twoPointConversion';
      clock: number;
      names: string[];
      t: TeamNum;
      success: boolean;
      // The play type used for the attempt — kept on the event so the
      // play-by-play UI can render "QB pass" vs "RB rush" without
      // having to infer it from the player position. A successful
      // attempt is worth 2 points; a failure is worth 0 (no kick).
      playType: 'pass' | 'run';
    }
  | {
      type: 'sack';
      clock: number;
      names: string[];
      safety: boolean;
      t: TeamNum;
      yds: number;
    }
  | {
      type: 'interception';
      clock: number;
      names: string[];
      t: TeamNum;
      td: boolean;
      yds: number;
    }
  | {
      type: 'fumble';
      clock: number;
      names: string[];
      t: TeamNum;
      td: boolean;
      yds: number;
    }
  // Dedicated celebration events for defensive return touchdowns. We
  // emit these IN ADDITION to the underlying interception/fumble event
  // (which carries td=true) so consumers that care specifically about
  // pick-six / fumble-six (e.g. season-leader boards) don't have to
  // pattern-match on `type === 'interception' && td`.
  | {
      type: 'pickSix';
      clock: number;
      names: string[];
      pid: number;
      t: TeamNum;
      yds: number;
    }
  | {
      type: 'fumbleSix';
      clock: number;
      names: string[];
      pid: number;
      t: TeamNum;
      yds: number;
    };

export type PlayByPlayEventInput =
  | ScoringEventInput
  | {
      type: 'quarter';
      clock: number;
      quarter: number;
    }
  | {
      type: 'overtime';
      clock: number;
      overtimeNum: number;
    }
  | {
      type: 'gameOver';
      clock: number;
      final: boolean;
    }
  | {
      type: 'kickoff';
      clock: number;
      names: string[];
      t: TeamNum;
      touchback: boolean;
      yds: number;
    }
  | {
      type: 'punt';
      clock: number;
      names: string[];
      t: TeamNum;
      touchback: boolean;
      yds: number;
    }
  | {
      type: 'passIncomplete';
      clock: number;
      names: string[];
      t: TeamNum;
    }
  | {
      type: 'penalty';
      clock: number;
      names: string[];
      penaltyName: string;
      t: TeamNum;
      yds: number;
    }
  | {
      type: 'timeout';
      clock: number;
      t: TeamNum;
    }
  | {
      type: 'twoMinuteWarning';
      clock: number;
    }
  | {
      type: 'turnoverOnDowns';
      clock: number;
      t: TeamNum;
    }
  | {
      type: 'kneel';
      clock: number;
      names: string[];
      t: TeamNum;
      yds: number;
    };

export type PlayByPlayEventScore = ScoringEventInput & {
  quarter: number;
};

export type PlayByPlayEvent = PlayByPlayEventInput & {
  down?: number;
  toGo?: number;
  scrimmage?: number;
};

export type ClockState = {
  down: number;
  toGo: number;
  scrimmage: number;
  t: TeamNum;
};

class PlayByPlayLogger {
  active: boolean;
  playByPlay: PlayByPlayEvent[] = [];
  scoringSummary: PlayByPlayEventScore[] = [];
  quarter = 1;
  overtimeNum = 0;

  /**
   * Optional sink for streaming events (e.g. a Web Worker bridge).
   * Receives the same object reference that was just pushed onto
   * `playByPlay`, so consumers can rely on identity / order.
   * Errors thrown by the callback are swallowed so a buggy sink can
   * never break the simulation.
   */
  onEvent?: (event: PlayByPlayEvent) => void;

  constructor(active: boolean = true) {
    this.active = active;
  }

  logEvent(event: PlayByPlayEventInput) {
    if (!this.active) return;

    if (event.type === 'quarter') {
      this.quarter = event.quarter;
    }
    if (event.type === 'overtime') {
      this.overtimeNum = event.overtimeNum;
    }

    const stored: PlayByPlayEvent = { ...event };
    this.playByPlay.push(stored);

    if (this.isScoringEvent(event)) {
      this.scoringSummary.push({
        ...event,
        quarter: this.quarter,
      });
    }

    if (this.onEvent) {
      try {
        this.onEvent(stored);
      } catch {
        // Defensive: don't let a sink crash the sim loop.
      }
    }
  }

  logClock(state: ClockState) {
    if (!this.active) return;

    const lastEvent = this.playByPlay[this.playByPlay.length - 1];
    if (lastEvent) {
      lastEvent.down = state.down;
      lastEvent.toGo = state.toGo;
      lastEvent.scrimmage = state.scrimmage;
    }
  }

  private isScoringEvent(event: PlayByPlayEventInput): event is ScoringEventInput {
    const scoringTypes = [
      'kickoffReturn',
      'puntReturn',
      'pass',
      'run',
      'fieldGoal',
      'extraPoint',
      'twoPointConversion',
      'sack',
      'interception',
      'fumble',
      'pickSix',
      'fumbleSix',
    ];
    return scoringTypes.includes(event.type);
  }

  getPlayByPlay(): PlayByPlayEvent[] {
    return this.playByPlay;
  }

  getScoringSummary(): PlayByPlayEventScore[] {
    return this.scoringSummary;
  }

  formatTime(clock: number): string {
    const minutes = Math.floor(clock);
    const seconds = Math.floor((clock % 1) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  formatQuarter(): string {
    if (this.overtimeNum > 0) {
      return `OT${this.overtimeNum > 1 ? this.overtimeNum : ''}`;
    }
    const quarterNames = ['1st', '2nd', '3rd', '4th'];
    return quarterNames[this.quarter - 1] || `${this.quarter}th`;
  }

  describeEvent(event: PlayByPlayEvent, teamNames: [string, string]): string {
    const teamName = 't' in event ? teamNames[event.t] : '';
    const time = this.formatTime(event.clock);
    const quarter = this.formatQuarter();

    const parts: string[] = [`[${quarter} ${time}]`];

    switch (event.type) {
      case 'kickoff':
        parts.push(`${event.names[0]} kicks ${event.yds} yards`);
        if (event.touchback) parts.push('- Touchback');
        break;
      case 'kickoffReturn':
        parts.push(`${event.names[0]} returns kickoff ${event.yds} yards`);
        if (event.td) parts.push('- TOUCHDOWN!');
        break;
      case 'punt':
        parts.push(`${event.names[0]} punts ${event.yds} yards`);
        if (event.touchback) parts.push('- Touchback');
        break;
      case 'puntReturn':
        parts.push(`${event.names[0]} returns punt ${event.yds} yards`);
        if (event.td) parts.push('- TOUCHDOWN!');
        break;
      case 'pass':
        parts.push(`${event.names[0]} pass to ${event.names[1]} for ${event.yds} yards`);
        if (event.td) parts.push('- TOUCHDOWN!');
        if (event.safety) parts.push('- SAFETY!');
        break;
      case 'passIncomplete':
        parts.push(`${event.names[0]} pass incomplete`);
        break;
      case 'run':
        parts.push(`${event.names[0]} runs for ${event.yds} yards`);
        if (event.td) parts.push('- TOUCHDOWN!');
        if (event.safety) parts.push('- SAFETY!');
        break;
      case 'sack':
        parts.push(`${event.names[0]} sacked by ${event.names[1]} for -${Math.abs(event.yds)} yards`);
        if (event.safety) parts.push('- SAFETY!');
        break;
      case 'fieldGoal':
        parts.push(`${event.names[0]} ${event.made ? 'makes' : 'misses'} ${event.yds} yard FG`);
        break;
      case 'extraPoint':
        parts.push(`${event.names[0]} ${event.made ? 'makes' : 'misses'} XP`);
        break;
      case 'twoPointConversion':
        parts.push(
          `${event.names[0]} 2-pt ${event.playType} ${event.success ? 'GOOD' : 'NO GOOD'}`,
        );
        break;
      case 'interception':
        parts.push(`Pass intercepted by ${event.names[0]}`);
        if (event.td) parts.push('- TOUCHDOWN!');
        else parts.push(`returned ${event.yds} yards`);
        break;
      case 'fumble':
        parts.push(`Fumble by ${event.names[0]}, recovered by ${event.names[1]}`);
        if (event.td) parts.push('- TOUCHDOWN!');
        break;
      case 'pickSix':
        parts.push(`PICK SIX! ${event.names[0]} returns interception ${event.yds} yards for a TD`);
        break;
      case 'fumbleSix':
        parts.push(`FUMBLE SIX! ${event.names[0]} returns fumble ${event.yds} yards for a TD`);
        break;
      case 'kneel':
        parts.push(`${event.names[0]} kneels for -${Math.abs(event.yds)} yards`);
        break;
      case 'turnoverOnDowns':
        parts.push(`Turnover on downs - ${teamName} takes over`);
        break;
      case 'quarter':
        parts.push(`--- End of ${event.quarter}${this.getOrdinal(event.quarter)} Quarter ---`);
        break;
      case 'overtime':
        parts.push(`--- Overtime ${event.overtimeNum} Begins ---`);
        break;
      case 'gameOver':
        parts.push('=== GAME OVER ===');
        break;
      case 'penalty':
        parts.push(`Penalty on ${teamName}: ${event.penaltyName} (${event.yds} yards)`);
        break;
      case 'timeout':
        parts.push(`${teamName} calls timeout`);
        break;
      case 'twoMinuteWarning':
        parts.push('*** Two Minute Warning ***');
        break;
    }

    if (event.down && event.toGo && event.scrimmage !== undefined && 't' in event) {
      const fieldPos = this.formatFieldPosition(event.scrimmage, event.t, teamNames);
      parts.push(`(${event.down}${this.getOrdinal(event.down)} & ${event.toGo} at ${fieldPos})`);
    }

    return parts.join(' ');
  }

  private getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  private formatFieldPosition(scrimmage: number, t: TeamNum, teamNames: [string, string]): string {
    if (scrimmage <= 0) return `${teamNames[1 - t]} goal line`;
    if (scrimmage >= 100) return `${teamNames[t]} goal line`;
    if (scrimmage <= 50) return `${teamNames[1 - t]} ${50 - scrimmage}`;
    return `${teamNames[t]} ${scrimmage - 50}`;
  }
}

export default PlayByPlayLogger;
