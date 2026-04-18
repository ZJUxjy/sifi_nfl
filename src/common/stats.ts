/**
 * Player Statistics Types
 * Comprehensive football statistics tracking
 */

// Passing stats
export type PassingStats = {
  // Attempts and completions
  att: number;        // Pass attempts
  cmp: number;        // Completions
  inc: number;        // Incompletions

  // Yards
  yds: number;        // Passing yards
  ydsAir: number;     // Air yards (yards in air)
  ydsYAC: number;     // Yards after catch

  // Touchdowns and turnovers
  td: number;         // Passing touchdowns
  int: number;        // Interceptions thrown
  intTD: number;      // Interceptions returned for TD (against)

  // Sacks
  sacked: number;     // Times sacked
  sackedYds: number;  // Yards lost on sacks

  // Other
  rate: number;       // Passer rating
  fmb: number;        // Fumbles
  fmbLost: number;    // Fumbles lost
};

// Rushing stats
export type RushingStats = {
  att: number;        // Rush attempts
  yds: number;        // Rushing yards
  td: number;         // Rushing touchdowns
  lng: number;        // Longest rush
  lngTD: boolean;     // Whether longest was a TD
  fmb: number;        // Fumbles
  fmbLost: number;    // Fumbles lost
  ypc: number;        // Yards per carry (calculated)
  firstDowns: number; // Rushing first downs
  brokenTackles: number; // Broken tackles
};

// Receiving stats
export type ReceivingStats = {
  tgt: number;        // Targets
  rec: number;        // Receptions
  yds: number;        // Receiving yards
  ydsAir: number;     // Air yards
  ydsYAC: number;     // Yards after catch
  td: number;         // Receiving touchdowns
  lng: number;        // Longest reception
  lngTD: boolean;     // Whether longest was a TD
  fmb: number;        // Fumbles
  fmbLost: number;    // Fumbles lost
  drops: number;      // Dropped passes
  firstDowns: number; // Receiving first downs
  ypr: number;        // Yards per reception (calculated)
  ctchPct: number;    // Catch percentage (calculated)
};

// Defense stats
export type DefenseStats = {
  // Tackles
  tck: number;        // Total tackles
  tckSolo: number;    // Solo tackles
  tckAst: number;     // Assisted tackles
  tfl: number;        // Tackles for loss
  tflYds: number;     // Yards lost on TFL

  // Sacks
  sk: number;         // Sacks
  skYds: number;      // Sack yards
  qbHit: number;      // QB hits (no sack)

  // Turnovers
  int: number;        // Interceptions
  intYds: number;     // Interception return yards
  intTD: number;      // Interception return TDs
  ff: number;         // Forced fumbles
  fr: number;         // Fumble recoveries
  frYds: number;      // Fumble return yards
  frTD: number;       // Fumble return TDs

  // Pass defense
  pd: number;         // Passes defended
  blk: number;        // Blocked kicks

  // Safeties
  saf: number;        // Safeties
};

// Kicking stats
export type KickingStats = {
  fgAtt: number;      // Field goal attempts
  fgMade: number;     // Field goals made
  fgLng: number;      // Longest FG made
  fgBlk: number;      // FG blocked
  xpAtt: number;      // Extra point attempts
  xpMade: number;     // Extra points made
  ko: number;         // Kickoffs
  koYds: number;      // Kickoff yards
  koTB: number;        // Touchbacks
  koOOB: number;      // Kickoffs out of bounds
  koOnside: number;   // Onside kick attempts
  koOnsideRec: number; // Onside kicks recovered
};

// Punting stats
export type PuntingStats = {
  pnt: number;        // Punts
  yds: number;        // Punt yards
  lng: number;        // Longest punt
  blk: number;        // Blocked punts
  in20: number;       // Punts inside 20
  tb: number;         // Touchbacks
  fc: number;         // Fair catches
  net: number;        // Net punt yards
};

// Kick/Punt return stats
export type ReturnStats = {
  kr: number;         // Kick returns
  krYds: number;      // Kick return yards
  krLng: number;      // Longest kick return
  krTD: number;       // Kick return TDs
  pr: number;         // Punt returns
  prYds: number;      // Punt return yards
  prLng: number;      // Longest punt return
  prTD: number;       // Punt return TDs
  fmb: number;        // Fumbles on returns
};

// Complete player stats for a single game
export type PlayerGameStats = {
  gp: number;         // Games played (0 or 1)
  gs: number;         // Games started (0 or 1)

  // Position-specific stats
  pass: PassingStats;
  rush: RushingStats;
  recv: ReceivingStats;
  def: DefenseStats;
  kick: KickingStats;
  punt: PuntingStats;
  ret: ReturnStats;

  // Meta
  snp: number;        // Snap count (plays on field)
  pts: number;        // Total points scored
};

// Season stats (accumulated from game stats)
export type PlayerSeasonStats = PlayerGameStats & {
  pid: number;        // Player ID
  tid: number;        // Team ID
  season: number;     // Season year
  playoffs: boolean;  // Playoff stats or regular season
};

// Career stats (accumulated from season stats)
export type PlayerCareerStats = PlayerGameStats & {
  pid: number;
  seasons: number[];  // Seasons played
};

// Team game stats
export type TeamGameStats = {
  pts: number;        // Points scored
  ptsQtrs: [number, number, number, number, number?]; // Points per quarter (5th for OT)

  // Offensive totals
  totalYds: number;   // Total yards
  totalPlays: number; // Total plays

  // Passing
  pssAtt: number;
  pssCmp: number;
  pssYds: number;
  pssTD: number;
  pssInt: number;

  // Rushing
  rusAtt: number;
  rusYds: number;
  rusTD: number;

  // Turnovers
  fmb: number;
  fmbLost: number;
  int: number;

  // Penalties
  pen: number;
  penYds: number;

  // 3rd/4th down
  thirdDownAtt: number;
  thirdDownCmp: number;
  fourthDownAtt: number;
  fourthDownCmp: number;

  // Red zone
  rzAtt: number;
  rzTD: number;
  rzFG: number;

  // Time of possession (in seconds)
  top: number;

  // Kicking
  fgMade: number;
  fgAtt: number;
  xpMade: number;
  xpAtt: number;

  // Punting
  punts: number;
  puntYds: number;
};

// Default empty stats
export const DEFAULT_PASSING_STATS: PassingStats = {
  att: 0, cmp: 0, inc: 0,
  yds: 0, ydsAir: 0, ydsYAC: 0,
  td: 0, int: 0, intTD: 0,
  sacked: 0, sackedYds: 0,
  rate: 0, fmb: 0, fmbLost: 0,
};

export const DEFAULT_RUSHING_STATS: RushingStats = {
  att: 0, yds: 0, td: 0,
  lng: 0, lngTD: false,
  fmb: 0, fmbLost: 0,
  ypc: 0, firstDowns: 0, brokenTackles: 0,
};

export const DEFAULT_RECEIVING_STATS: ReceivingStats = {
  tgt: 0, rec: 0, yds: 0,
  ydsAir: 0, ydsYAC: 0,
  td: 0, lng: 0, lngTD: false,
  fmb: 0, fmbLost: 0, drops: 0,
  firstDowns: 0, ypr: 0, ctchPct: 0,
};

export const DEFAULT_DEFENSE_STATS: DefenseStats = {
  tck: 0, tckSolo: 0, tckAst: 0,
  tfl: 0, tflYds: 0,
  sk: 0, skYds: 0, qbHit: 0,
  int: 0, intYds: 0, intTD: 0,
  ff: 0, fr: 0, frYds: 0, frTD: 0,
  pd: 0, blk: 0, saf: 0,
};

export const DEFAULT_KICKING_STATS: KickingStats = {
  fgAtt: 0, fgMade: 0, fgLng: 0, fgBlk: 0,
  xpAtt: 0, xpMade: 0,
  ko: 0, koYds: 0, koTB: 0, koOOB: 0,
  koOnside: 0, koOnsideRec: 0,
};

export const DEFAULT_PUNTING_STATS: PuntingStats = {
  pnt: 0, yds: 0, lng: 0, blk: 0,
  in20: 0, tb: 0, fc: 0, net: 0,
};

export const DEFAULT_RETURN_STATS: ReturnStats = {
  kr: 0, krYds: 0, krLng: 0, krTD: 0,
  pr: 0, prYds: 0, prLng: 0, prTD: 0,
  fmb: 0,
};

export const DEFAULT_PLAYER_GAME_STATS: PlayerGameStats = {
  gp: 0, gs: 0,
  pass: { ...DEFAULT_PASSING_STATS },
  rush: { ...DEFAULT_RUSHING_STATS },
  recv: { ...DEFAULT_RECEIVING_STATS },
  def: { ...DEFAULT_DEFENSE_STATS },
  kick: { ...DEFAULT_KICKING_STATS },
  punt: { ...DEFAULT_PUNTING_STATS },
  ret: { ...DEFAULT_RETURN_STATS },
  snp: 0, pts: 0,
};

// Calculate passer rating (NFL formula)
export function calculatePasserRating(stats: PassingStats): number {
  if (stats.att === 0) return 0;

  const a = ((stats.cmp / stats.att) - 0.3) * 5;
  const b = ((stats.yds / stats.att) - 3) * 0.25;
  const c = (stats.td / stats.att) * 20;
  const d = 2.375 - (stats.int / stats.att) * 25;

  const clamp = (val: number) => Math.max(0, Math.min(2.375, val));

  return ((clamp(a) + clamp(b) + clamp(c) + clamp(d)) / 6) * 100;
}

// Aggregate stats from multiple games
export function aggregateStats(base: PlayerGameStats, add: PlayerGameStats): PlayerGameStats {
  const agg = (a: number, b: number) => a + b;

  return {
    gp: agg(base.gp, add.gp),
    gs: agg(base.gs, add.gs),
    snp: agg(base.snp, add.snp),
    pts: agg(base.pts, add.pts),

    pass: {
      att: agg(base.pass.att, add.pass.att),
      cmp: agg(base.pass.cmp, add.pass.cmp),
      inc: agg(base.pass.inc, add.pass.inc),
      yds: agg(base.pass.yds, add.pass.yds),
      ydsAir: agg(base.pass.ydsAir, add.pass.ydsAir),
      ydsYAC: agg(base.pass.ydsYAC, add.pass.ydsYAC),
      td: agg(base.pass.td, add.pass.td),
      int: agg(base.pass.int, add.pass.int),
      intTD: agg(base.pass.intTD, add.pass.intTD),
      sacked: agg(base.pass.sacked, add.pass.sacked),
      sackedYds: agg(base.pass.sackedYds, add.pass.sackedYds),
      fmb: agg(base.pass.fmb, add.pass.fmb),
      fmbLost: agg(base.pass.fmbLost, add.pass.fmbLost),
      rate: 0, // Calculated after aggregation
    },

    rush: {
      att: agg(base.rush.att, add.rush.att),
      yds: agg(base.rush.yds, add.rush.yds),
      td: agg(base.rush.td, add.rush.td),
      lng: Math.max(base.rush.lng, add.rush.lng),
      lngTD: base.rush.lngTD || add.rush.lngTD,
      fmb: agg(base.rush.fmb, add.rush.fmb),
      fmbLost: agg(base.rush.fmbLost, add.rush.fmbLost),
      ypc: 0, // Calculated
      firstDowns: agg(base.rush.firstDowns, add.rush.firstDowns),
      brokenTackles: agg(base.rush.brokenTackles, add.rush.brokenTackles),
    },

    recv: {
      tgt: agg(base.recv.tgt, add.recv.tgt),
      rec: agg(base.recv.rec, add.recv.rec),
      yds: agg(base.recv.yds, add.recv.yds),
      ydsAir: agg(base.recv.ydsAir, add.recv.ydsAir),
      ydsYAC: agg(base.recv.ydsYAC, add.recv.ydsYAC),
      td: agg(base.recv.td, add.recv.td),
      lng: Math.max(base.recv.lng, add.recv.lng),
      lngTD: base.recv.lngTD || add.recv.lngTD,
      fmb: agg(base.recv.fmb, add.recv.fmb),
      fmbLost: agg(base.recv.fmbLost, add.recv.fmbLost),
      drops: agg(base.recv.drops, add.recv.drops),
      firstDowns: agg(base.recv.firstDowns, add.recv.firstDowns),
      ypr: 0, // Calculated
      ctchPct: 0, // Calculated
    },

    def: {
      tck: agg(base.def.tck, add.def.tck),
      tckSolo: agg(base.def.tckSolo, add.def.tckSolo),
      tckAst: agg(base.def.tckAst, add.def.tckAst),
      tfl: agg(base.def.tfl, add.def.tfl),
      tflYds: agg(base.def.tflYds, add.def.tflYds),
      sk: agg(base.def.sk, add.def.sk),
      skYds: agg(base.def.skYds, add.def.skYds),
      qbHit: agg(base.def.qbHit, add.def.qbHit),
      int: agg(base.def.int, add.def.int),
      intYds: agg(base.def.intYds, add.def.intYds),
      intTD: agg(base.def.intTD, add.def.intTD),
      ff: agg(base.def.ff, add.def.ff),
      fr: agg(base.def.fr, add.def.fr),
      frYds: agg(base.def.frYds, add.def.frYds),
      frTD: agg(base.def.frTD, add.def.frTD),
      pd: agg(base.def.pd, add.def.pd),
      blk: agg(base.def.blk, add.def.blk),
      saf: agg(base.def.saf, add.def.saf),
    },

    kick: {
      fgAtt: agg(base.kick.fgAtt, add.kick.fgAtt),
      fgMade: agg(base.kick.fgMade, add.kick.fgMade),
      fgLng: Math.max(base.kick.fgLng, add.kick.fgLng),
      fgBlk: agg(base.kick.fgBlk, add.kick.fgBlk),
      xpAtt: agg(base.kick.xpAtt, add.kick.xpAtt),
      xpMade: agg(base.kick.xpMade, add.kick.xpMade),
      ko: agg(base.kick.ko, add.kick.ko),
      koYds: agg(base.kick.koYds, add.kick.koYds),
      koTB: agg(base.kick.koTB, add.kick.koTB),
      koOOB: agg(base.kick.koOOB, add.kick.koOOB),
      koOnside: agg(base.kick.koOnside, add.kick.koOnside),
      koOnsideRec: agg(base.kick.koOnsideRec, add.kick.koOnsideRec),
    },

    punt: {
      pnt: agg(base.punt.pnt, add.punt.pnt),
      yds: agg(base.punt.yds, add.punt.yds),
      lng: Math.max(base.punt.lng, add.punt.lng),
      blk: agg(base.punt.blk, add.punt.blk),
      in20: agg(base.punt.in20, add.punt.in20),
      tb: agg(base.punt.tb, add.punt.tb),
      fc: agg(base.punt.fc, add.punt.fc),
      net: agg(base.punt.net, add.punt.net),
    },

    ret: {
      kr: agg(base.ret.kr, add.ret.kr),
      krYds: agg(base.ret.krYds, add.ret.krYds),
      krLng: Math.max(base.ret.krLng, add.ret.krLng),
      krTD: agg(base.ret.krTD, add.ret.krTD),
      pr: agg(base.ret.pr, add.ret.pr),
      prYds: agg(base.ret.prYds, add.ret.prYds),
      prLng: Math.max(base.ret.prLng, add.ret.prLng),
      prTD: agg(base.ret.prTD, add.ret.prTD),
      fmb: agg(base.ret.fmb, add.ret.fmb),
    },
  };
}

// Calculate derived stats after aggregation
export function finalizeStats(stats: PlayerGameStats): PlayerGameStats {
  // Passer rating
  stats.pass.rate = calculatePasserRating(stats.pass);

  // Yards per carry
  stats.rush.ypc = stats.rush.att > 0 ? stats.rush.yds / stats.rush.att : 0;

  // Yards per reception
  stats.recv.ypr = stats.recv.rec > 0 ? stats.recv.yds / stats.recv.rec : 0;

  // Catch percentage
  stats.recv.ctchPct = stats.recv.tgt > 0 ? (stats.recv.rec / stats.recv.tgt) * 100 : 0;

  return stats;
}
