import { describe, it, expect } from 'vitest';
import { SeasonManager } from '../worker/core/season/seasonManagerV2';
import type { Team } from '../common/entities';

function makeTeam(partial: Partial<Team> & Pick<Team, 'tid' | 'region'>): Team {
  return {
    cid: 0,
    did: 0,
    name: `T${partial.tid}`,
    abbrev: 'TST',
    colors: ['#000', '#000', '#000'],
    pop: 'Medium',
    srID: `s${partial.tid}`,
    budget: 0,
    cash: 0,
    salaryPaid: 0,
    season: 2026,
    won: 0,
    lost: 0,
    playoffsRoundsWon: -1,
    streak: 0,
    lastTen: '',
    ...partial,
  } as Team;
}

describe('mining island pyramid tiering', () => {
  it('groups schedule strictly by team.tier, regardless of array order', () => {
    // 80 mining teams, interleaved so the array index has no relation
    // to tier. The old "Math.floor(idx / 20)" tiering would mis-group
    // every match because a tier-1 team and a tier-3 team would both
    // land in array slot < 20.
    const teams: Team[] = [];
    let tid = 1000;
    for (let i = 0; i < 20; i++) {
      for (let tier = 1; tier <= 4; tier++) {
        teams.push(makeTeam({ tid: tid++, region: 'miningIsland', tier }));
      }
    }
    const scrambled = teams;

    const sm = new SeasonManager(2026, scrambled);
    sm.startRegularSeason();

    const miningGames = sm.schedule.filter(g => {
      const home = scrambled.find(t => t.tid === g.homeTid);
      return home && home.region === 'miningIsland';
    });
    expect(miningGames.length).toBeGreaterThan(0);

    for (const g of miningGames) {
      const home = scrambled.find(t => t.tid === g.homeTid)!;
      const away = scrambled.find(t => t.tid === g.awayTid)!;
      expect(home.tier, `home tid ${home.tid}`).toBe(away.tier);
    }
  });
});

describe('origin continent league bucketing', () => {
  it('uses team.leagueIndex (0..2), not team.did % 3', () => {
    // Build 36 origin teams whose `did` deliberately does NOT match
    // (did % 3) === leagueIndex. The old code that used `did % 3`
    // would scatter same-league teams into different buckets.
    const teams: Team[] = [];
    for (let leagueIndex = 0; leagueIndex < 3; leagueIndex++) {
      for (let i = 0; i < 12; i++) {
        teams.push(
          makeTeam({
            tid: leagueIndex * 100 + i,
            region: 'originContinent',
            leagueIndex,
            did: i,
          })
        );
      }
    }

    const sm = new SeasonManager(2026, teams);
    sm.startRegularSeason();

    const originGames = sm.schedule.filter(g => {
      const home = teams.find(t => t.tid === g.homeTid);
      return home && home.region === 'originContinent';
    });
    expect(originGames.length).toBeGreaterThan(0);

    for (const g of originGames) {
      const home = teams.find(t => t.tid === g.homeTid)!;
      const away = teams.find(t => t.tid === g.awayTid)!;
      expect(home.leagueIndex, `home tid ${home.tid}`).toBe(away.leagueIndex);
    }
  });
});
