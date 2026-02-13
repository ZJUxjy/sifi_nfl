import { generateAllTeams } from '../worker/core/team/index';
import { SeasonManager } from '../worker/core/season/index';
import { GameSim } from '../worker/core/game/GameSim';
import type { Team, Player } from '../common/entities';
import type { TeamGameSim, PlayerGameSim } from '../worker/core/game/types';
import { calculateCompositeRatings } from '../worker/core/player/ovr';
import { listSaves, saveGame, loadGame, formatDate, type SaveData } from './saveManager';
import PlayByPlayLogger, { type PlayByPlayEvent } from '../worker/core/game/PlayByPlayLogger';
import { getWeeklyInjuryUpdate } from '../worker/core/game/injuries';
import {
  isImperialCupYear,
  getNextImperialCupYear,
  qualifyForImperialCup,
  generateImperialCupBracket,
  advanceRound,
  getRoundName,
  type ImperialCupMatch,
  type ImperialCupSeason,
  IMPERIAL_CUP_HISTORY,
} from '../worker/core/imperialCup/index';
import {
  calculatePlayerValue,
  evaluateTrade,
  createTradeAsset,
  shouldAcceptTrade,
  executeTrade,
  isPlayerTradable,
  type TradeProposal,
  type TradeAsset,
} from '../worker/core/trade/evaluate';
import {
  getFreeAgents,
  generateContractDemand,
  evaluateOffer,
  signFreeAgent,
  generateFreeAgentPool,
  type FreeAgentDemand,
} from '../worker/core/freeAgent/market';
import {
  generateDraftPool,
  calculateDraftOrder,
  selectPlayer,
  type DraftProspect,
} from '../worker/core/draft/pool';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import ora from 'ora';

type LastGameInfo = {
  playByPlay: PlayByPlayEvent[];
  scoringSummary: PlayByPlayEvent[];
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  penalties?: { team: string; count: number; yards: number }[];
  injuries?: { player: string; injury: string }[];
};

type GameImperialCup = ImperialCupSeason & {
  matches: ImperialCupMatch[];
};

class SIFINFLGame {
  teams: Team[] = [];
  players: Player[] = [];
  freeAgents: Player[] = [];
  draftProspects: DraftProspect[] = [];
  season: SeasonManager | null = null;
  userTeam: Team | null = null;
  seasonYear: number = 2025;
  lastGameInfo: LastGameInfo | null = null;
  imperialCup: GameImperialCup | null = null;

  async init() {
    console.clear();
    console.log(chalk.cyan.bold('\n  ███████╗██╗███████╗██╗     ███╗   ██╗███████╗██╗     \n'));
    console.log(chalk.cyan.bold('  ╚══███╔╝██║██╔════╝██║     ████╗  ██║██╔════╝██║     \n'));
    console.log(chalk.cyan.bold('    ███╔╝ ██║█████╗  ██║     ██╔██╗ ██║█████╗  ██║     \n'));
    console.log(chalk.cyan.bold('   ███╔╝  ██║██╔══╝  ██║     ██║╚██╗██║██╔══╝  ██║     \n'));
    console.log(chalk.cyan.bold('  ███████╗██║██║     ███████╗██║ ╚████║██║     ███████╗\n'));
    console.log(chalk.yellow.bold('\n        Sci-Fi American Football Manager\n'));
    
    await this.mainMenu();
  }

  async mainMenu() {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Main Menu:',
      choices: [
        { name: '🎮 New Game', value: 'new' },
        { name: '📊 Load Game', value: 'load' },
        { name: '❌ Exit', value: 'exit' }
      ]
    }]);

    switch (action) {
      case 'new':
        await this.startNewGame();
        break;
      case 'load':
        await this.loadGameMenu();
        break;
      case 'exit':
        console.log(chalk.green('\nThanks for playing SIFI NFL!\n'));
        process.exit(0);
    }
  }

  async startNewGame() {
    const spinner = ora('Generating universe...').start();
    
    const result = generateAllTeams(this.seasonYear);
    this.teams = result.teams;
    this.players = result.players;
    this.freeAgents = generateFreeAgentPool([], 50, this.seasonYear);
    
    spinner.succeed(`Generated ${this.teams.length} teams, ${this.players.length} players, and ${this.freeAgents.length} free agents`);
    
    await this.selectTeam();
  }

  async selectTeam() {
    const regionNames: Record<string, string> = {
      firstContinent: '🌍 First Continent (36 teams, closed league)',
      secondContinent: '🌎 Second Continent (40 teams, closed league)',
      originContinent: '🏛️  Origin Continent (3 leagues x 12 teams, championship/relegation)',
      miningIsland: '⛏️  Mining Island (4-tier pyramid, 58 teams)',
    };

    const { region } = await inquirer.prompt([{
      type: 'list',
      name: 'region',
      message: 'Select your region:',
      choices: Object.entries(regionNames).map(([key, name]) => ({
        name,
        value: key
      }))
    }]);

    if (region === 'originContinent') {
      return this.selectOriginContinentTeam();
    }

    if (region === 'miningIsland') {
      return this.selectMiningIslandTeam();
    }

    const regionTeams = this.teams.filter(t => t.region === region);

    const strengthLabel = (s?: string) => {
      switch (s) {
        case 'elite': return '⭐⭐⭐';
        case 'strong': return '⭐⭐';
        case 'average': return '⭐';
        case 'weak': return '';
        default: return '';
      }
    };

    const marketLabel = (m?: string) => {
      switch (m) {
        case 'huge': return '💰💰💰';
        case 'large': return '💰💰';
        case 'medium': return '💰';
        case 'small': return '';
        default: return '';
      }
    };

    const teamChoices = regionTeams.map(t => ({
      name: `${strengthLabel(t.strength)} ${t.name} ${marketLabel(t.market)} - $${(t.budget / 1000).toFixed(0)}M`,
      value: t
    }));

    const { team } = await inquirer.prompt([{
      type: 'list',
      name: 'team',
      message: `Select your team in ${region}:`,
      choices: teamChoices,
      pageSize: 15
    }]);

    this.userTeam = team;
    console.log(chalk.green(`\nWelcome, GM of ${team.name}!\n`));
    console.log(`Market: ${team.market || 'medium'} | Budget: $${(team.budget / 1000).toFixed(0)}M | Cash: $${(team.cash / 1000).toFixed(0)}M\n`);

    this.season = new SeasonManager(this.seasonYear, this.teams);
    this.season.startRegularSeason();
    
    await this.gameMenu();
  }

  async selectOriginContinentTeam() {
    const { league } = await inquirer.prompt([{
      type: 'list',
      name: 'league',
      message: 'Select your league:',
      choices: [
        { name: '🏛️  Metropolis League (Top tier, includes Emperors, Eagles)', value: 'metropolis' },
        { name: '⚔️  Imperial League (Top tier, includes Raiders, Defenders)', value: 'imperial' },
        { name: '👑 Royal League (Top tier, includes Lions, Guards)', value: 'royal' },
      ]
    }]);

    const originTeams = this.teams.filter(t => t.region === 'originContinent');
    const teamsPerLeague = 12;
    const leagueStart = league === 'metropolis' ? 0 : league === 'imperial' ? 12 : 24;
    const leagueTeams = originTeams.slice(leagueStart, leagueStart + teamsPerLeague);

    const teamChoices = leagueTeams.map(t => ({
      name: `${t.name} - $${(t.budget / 1000).toFixed(0)}M`,
      value: t
    }));

    const { team } = await inquirer.prompt([{
      type: 'list',
      name: 'team',
      message: `Select your team:`,
      choices: teamChoices,
      pageSize: 12
    }]);

    this.userTeam = team;
    console.log(chalk.green(`\nWelcome, GM of ${team.name}!\n`));
    console.log(`League: ${league.charAt(0).toUpperCase() + league.slice(1)} League`);
    console.log(`Budget: $${(team.budget / 1000).toFixed(0)}M | Cash: $${(team.cash / 1000).toFixed(0)}M\n`);
    console.log(chalk.yellow('Origin Continent League Structure:'));
    console.log('  Phase 1: 11 games within your league');
    console.log('  Top 4 teams advance to Championship Group');
    console.log('  Bottom 8 teams go to Relegation Group');
    console.log('  Playoffs: Top 8 teams, double elimination\n');

    this.season = new SeasonManager(this.seasonYear, this.teams);
    this.season.startRegularSeason();
    
    await this.gameMenu();
  }

  async selectMiningIslandTeam() {
    const { level } = await inquirer.prompt([{
      type: 'list',
      name: 'level',
      message: 'Select your league level:',
      choices: [
        { name: '🏆 Super League (20 teams, top tier)', value: 1 },
        { name: '🥈 Championship (20 teams, 2nd tier)', value: 2 },
        { name: '🥉 A League (18 teams, 3rd tier)', value: 3 },
        { name: '4️⃣ B League (amateur level)', value: 4 },
      ]
    }]);

    const miningTeams = this.teams.filter(t => t.region === 'miningIsland');
    
    const levelSizes = [20, 20, 18];
    let start = 0;
    for (let i = 1; i < level; i++) {
      start += levelSizes[i-1] || 0;
    }
    const end = level <= 3 ? start + levelSizes[level-1] : miningTeams.length;
    const levelTeams = level <= 3 ? miningTeams.slice(start, end) : miningTeams.slice(58);

    const teamChoices = levelTeams.map(t => ({
      name: `${t.name} - $${(t.budget / 1000).toFixed(0)}M`,
      value: t
    }));

    const { team } = await inquirer.prompt([{
      type: 'list',
      name: 'team',
      message: `Select your team:`,
      choices: teamChoices,
      pageSize: 15
    }]);

    this.userTeam = team;
    console.log(chalk.green(`\nWelcome, GM of ${team.name}!\n`));
    
    const levelNames = ['', 'Super League', 'Championship', 'A League', 'B League'];
    console.log(`League: ${levelNames[level]}`);
    console.log(`Budget: $${(team.budget / 1000).toFixed(0)}M | Cash: $${(team.cash / 1000).toFixed(0)}M\n`);
    console.log(chalk.yellow('Mining Island League Structure:'));
    console.log('  4 levels with promotion/relegation');
    console.log('  Top 3 teams promoted each season');
    console.log('  Bottom 3 teams relegated each season\n');

    this.season = new SeasonManager(this.seasonYear, this.teams);
    this.season.startRegularSeason();
    
    await this.gameMenu();
  }

  async gameMenu() {
    const choices = [
      { name: '🏈 View Roster', value: 'roster' },
      { name: '📅 View Schedule', value: 'schedule' },
      { name: '🏆 Standings', value: 'standings' },
      { name: '▶️  Play Week', value: 'play' },
      { name: '⚡ Sim Week', value: 'sim' },
    ];
    
    if (this.lastGameInfo) {
      choices.push({ name: '📝 View Play-by-Play', value: 'playbyplay' });
    }
    
    const injuredPlayers = this.players.filter(p => p.tid === this.userTeam?.tid && p.injury && p.injury.gamesRemaining > 0);
    if (injuredPlayers.length > 0) {
      choices.push({ name: `🏥 Injuries (${injuredPlayers.length})`, value: 'injuries' });
    }
    
    choices.push(
      { name: '💰 Finances', value: 'finance' },
      { name: '🔄 Trade', value: 'trade' },
      { name: '📋 Free Agency', value: 'freeagency' },
      { name: '🎯 Draft', value: 'draft' },
      { name: '📈 Stats', value: 'stats' },
    );
    
    if (isImperialCupYear(this.seasonYear)) {
      choices.push({ name: '🏆 Imperial Cup', value: 'imperialcup' });
    } else {
      const nextYear = getNextImperialCupYear(this.seasonYear);
      choices.push({ name: `🏆 Imperial Cup (${nextYear})`, value: 'imperialcupinfo' });
    }
    
    choices.push(
      { name: '💾 Save Game', value: 'save' },
      { name: '🔙 Main Menu', value: 'menu' }
    );

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: `Week ${this.season?.currentWeek || 1} - ${this.userTeam?.name}:`,
      choices
    }]);

    switch (action) {
      case 'roster':
        await this.viewRoster();
        break;
      case 'schedule':
        await this.viewSchedule();
        break;
      case 'standings':
        await this.viewStandings();
        break;
      case 'play':
        await this.playWeek();
        break;
      case 'sim':
        await this.simWeek();
        break;
      case 'playbyplay':
        await this.viewPlayByPlay();
        break;
      case 'injuries':
        await this.viewInjuries();
        break;
      case 'finance':
        await this.viewFinances();
        break;
      case 'trade':
        await this.tradeMenu();
        break;
      case 'freeagency':
        await this.freeAgencyMenu();
        break;
      case 'stats':
        await this.viewStats();
        break;
      case 'draft':
        await this.draftMenu();
        break;
      case 'imperialcup':
        await this.imperialCupMenu();
        break;
      case 'imperialcupinfo':
        await this.imperialCupInfo();
        break;
      case 'save':
        await this.saveGameMenu();
        break;
      case 'menu':
        await this.mainMenu();
        return;
    }

    await this.gameMenu();
  }

  async viewRoster() {
    const teamPlayers = this.players.filter(p => p.tid === this.userTeam!.tid);
    
    const table = new Table({
      head: ['Pos', 'Name', 'Age', 'Ovr', 'Pot', 'Salary', 'Years', 'Status'],
      colWidths: [6, 25, 6, 6, 6, 12, 8, 12]
    });

    teamPlayers
      .sort((a, b) => b.ovr - a.ovr)
      .forEach(p => {
        const status = p.injury && p.injury.gamesRemaining > 0 
          ? chalk.red(`Injured (${p.injury.gamesRemaining})`)
          : chalk.green('Healthy');
        
        table.push([
          chalk.cyan(p.pos),
          p.name,
          p.age,
          p.ovr,
          p.pot,
          p.contract ? `${p.contract.amount}k` : 'FA',
          p.contract ? p.contract.years : '-',
          status,
        ]);
      });

    console.log(`\n${chalk.bold(this.userTeam!.name)} Roster (${teamPlayers.length} players)\n`);
    console.log(table.toString());
    console.log();
  }

  async viewSchedule() {
    if (!this.season) return;
    
    const table = new Table({
      head: ['Week', 'Opponent', 'Result'],
      colWidths: [8, 35, 20]
    });

    for (let week = 1; week <= 17; week++) {
      const game = this.season.schedule.find(g => 
        g.day === week && (g.homeTid === this.userTeam!.tid || g.awayTid === this.userTeam!.tid)
      );

      if (game) {
        const isHome = game.homeTid === this.userTeam!.tid;
        const opponent = this.teams.find(t => 
          t.tid === (isHome ? game.awayTid : game.homeTid)
        );

        let result = 'Upcoming';
        if (game.won) {
          const won = game.won.tid === this.userTeam!.tid;
          result = won ? chalk.green(`W ${game.won.pts}-${game.lost!.pts}`) : chalk.red(`L ${game.lost!.pts}-${game.won.pts}`);
        }

        table.push([
          week.toString(),
          `${isHome ? 'vs' : '@'} ${opponent?.name}`,
          result
        ]);
      }
    }

    console.log(`\n${chalk.bold(this.userTeam!.name)} Schedule\n`);
    console.log(table.toString());
    console.log();
  }

  async viewStandings() {
    if (!this.season) return;

    const standings = this.season.getStandings();
    const regionStandings = standings.filter(s => s.region === this.userTeam!.region);

    const table = new Table({
      head: ['Team', 'W', 'L', 'Pct', 'PF', 'PA', 'Strk'],
      colWidths: [25, 6, 6, 8, 8, 8, 8]
    });

    regionStandings.forEach(s => {
      const team = this.teams.find(t => t.tid === s.tid);
      const winPct = (s.won / (s.won + s.lost || 1)).toFixed(3);
      const isUser = s.tid === this.userTeam!.tid;
      
      table.push([
        isUser ? chalk.green.bold(team!.name) : team!.name,
        s.won,
        s.lost,
        winPct,
        s.pts,
        s.oppPts,
        s.streak > 0 ? `W${s.streak}` : `L${Math.abs(s.streak)}`
      ]);
    });

    console.log(`\n${chalk.bold(this.userTeam!.region)} Standings\n`);
    console.log(table.toString());
    console.log();
  }

  async playWeek() {
    if (!this.season) return;

    const weekGames = this.season.schedule.filter(g => g.day === this.season!.currentWeek);
    const userGame = weekGames.find(g => 
      g.homeTid === this.userTeam!.tid || g.awayTid === this.userTeam!.tid
    );

    if (!userGame) {
      console.log(chalk.yellow('No game this week'));
      return;
    }

    console.log(chalk.cyan.bold('\n🏈 GAME DAY\n'));
    
    const isHome = userGame.homeTid === this.userTeam!.tid;
    const opponent = this.teams.find(t => 
      t.tid === (isHome ? userGame.awayTid : userGame.homeTid)
    );

    console.log(`${chalk.bold(this.userTeam!.name)} ${isHome ? 'vs' : '@'} ${chalk.bold(opponent!.name)}`);
    console.log(`Week ${this.season.currentWeek}, ${this.seasonYear}\n`);

    await this.simulateGame(userGame, isHome);
    
    this.season.simWeek();
  }

  async simulateGame(game: any, isHome: boolean) {
    const homeTeam = this.teams.find(t => t.tid === game.homeTid)!;
    const awayTeam = this.teams.find(t => t.tid === game.awayTid)!;
    
    const homePlayers = this.players.filter(p => p.tid === homeTeam.tid).slice(0, 25);
    const awayPlayers = this.players.filter(p => p.tid === awayTeam.tid).slice(0, 25);

    const team1GameSim: TeamGameSim = {
      id: homeTeam.tid,
      stat: { pts: 0 },
      player: homePlayers.map(p => ({
        ...p,
        stat: {},
        compositeRating: calculateCompositeRatings(p),
        energy: 1,
        ptModifier: 1,
      })) as PlayerGameSim[],
      compositeRating: {} as any,
      depth: {} as any,
    };

    const team2GameSim: TeamGameSim = {
      id: awayTeam.tid,
      stat: { pts: 0 },
      player: awayPlayers.map(p => ({
        ...p,
        stat: {},
        compositeRating: calculateCompositeRatings(p),
        energy: 1,
        ptModifier: 1,
      })) as PlayerGameSim[],
      compositeRating: {} as any,
      depth: {} as any,
    };

    const gameSim = new GameSim({
      gid: game.gid,
      teams: [team1GameSim, team2GameSim],
      quarterLength: 1,
      numPeriods: 4,
    });

    const spinner = ora('Simulating game...').start();
    const result = gameSim.run();
    spinner.succeed('Game complete!');

    const penaltyStats = gameSim.getPenaltyStats();
    const gameInjuries = gameSim.injuries;

    this.lastGameInfo = {
      playByPlay: gameSim.playByPlayLogger.getPlayByPlay(),
      scoringSummary: gameSim.playByPlayLogger.getScoringSummary(),
      homeTeam: homeTeam.name,
      awayTeam: awayTeam.name,
      homeScore: result.teams[0].pts,
      awayScore: result.teams[1].pts,
      penalties: [
        { team: homeTeam.name, count: penaltyStats.team0Penalties, yards: penaltyStats.team0Yards },
        { team: awayTeam.name, count: penaltyStats.team1Penalties, yards: penaltyStats.team1Yards },
      ],
      injuries: gameInjuries.map(i => ({ player: i.player.name, injury: i.injury.type })),
    };

    for (const { player, injury } of gameInjuries) {
      const originalPlayer = this.players.find(p => p.pid === player.pid);
      if (originalPlayer) {
        originalPlayer.injury = injury;
      }
    }

    const userWon = result.teams[0].pts > result.teams[1].pts;
    const userScore = isHome ? result.teams[0].pts : result.teams[1].pts;
    const oppScore = isHome ? result.teams[1].pts : result.teams[0].pts;

    console.log(`\n${chalk.bold('FINAL SCORE')}`);
    console.log(`${homeTeam.name}: ${result.teams[0].pts}`);
    console.log(`${awayTeam.name}: ${result.teams[1].pts}`);
    
    if (userWon) {
      console.log(chalk.green.bold('\n🏆 VICTORY!\n'));
    } else {
      console.log(chalk.red.bold('\n❌ DEFEAT\n'));
    }

    game.won = { tid: userWon ? this.userTeam!.tid : (isHome ? game.awayTid : game.homeTid), pts: Math.max(userScore, oppScore) };
    game.lost = { tid: userWon ? (isHome ? game.awayTid : game.homeTid) : this.userTeam!.tid, pts: Math.min(userScore, oppScore) };
  }

  async simWeek() {
    if (!this.season) return;

    const spinner = ora(`Simulating Week ${this.season.currentWeek}...`).start();
    this.season.simWeek();
    spinner.succeed(`Week ${this.season.currentWeek - 1} complete!`);

    const recoveredPlayers: string[] = [];
    for (const player of this.players) {
      if (player.injury && player.injury.gamesRemaining > 0) {
        player.injury.gamesRemaining--;
        if (player.injury.gamesRemaining <= 0) {
          recoveredPlayers.push(player.name);
          player.injury = undefined;
        }
      }
    }
    
    if (recoveredPlayers.length > 0) {
      console.log(chalk.green(`\n🏥 Recovered from injury: ${recoveredPlayers.join(', ')}\n`));
    }

    const userGame = this.season.schedule.find(g => 
      g.day === this.season!.currentWeek - 1 && 
      (g.homeTid === this.userTeam!.tid || g.awayTid === this.userTeam!.tid)
    );

    if (userGame?.won) {
      const won = userGame.won.tid === this.userTeam!.tid;
      console.log(chalk[won ? 'green' : 'red'](`\n${won ? '🏆' : '❌'} ${this.userTeam!.name} ${won ? 'won' : 'lost'} ${userGame.won.pts}-${userGame.lost!.pts}\n`));
    }
  }

  async viewPlayByPlay() {
    if (!this.lastGameInfo) {
      console.log(chalk.yellow('\nNo game to display.\n'));
      return;
    }

    const { playByPlay, scoringSummary, homeTeam, awayTeam, homeScore, awayScore, penalties, injuries } = this.lastGameInfo;
    const teamNames: [string, string] = [homeTeam, awayTeam];
    const logger = new PlayByPlayLogger(true);

    const choices = [
      { name: '📜 Full Play-by-Play', value: 'full' },
      { name: '🏆 Scoring Summary', value: 'scoring' },
    ];
    
    if (penalties && penalties.length > 0) {
      choices.push({ name: '🚩 Penalties', value: 'penalties' });
    }
    
    if (injuries && injuries.length > 0) {
      choices.push({ name: '🏥 Injuries', value: 'injuries' });
    }
    
    choices.push({ name: '🔙 Back', value: 'back' });

    const { viewMode } = await inquirer.prompt([{
      type: 'list',
      name: 'viewMode',
      message: 'Play-by-Play Options:',
      choices,
    }]);

    if (viewMode === 'back') return;

    console.log(chalk.bold.cyan(`\n${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}\n`));

    if (viewMode === 'penalties' && penalties) {
      console.log(chalk.bold.yellow('PENALTIES\n'));
      for (const pen of penalties) {
        console.log(`  ${pen.team}: ${pen.count} for ${pen.yards} yards`);
      }
      console.log();
    } else if (viewMode === 'injuries' && injuries) {
      console.log(chalk.bold.yellow('INJURIES\n'));
      for (const inj of injuries) {
        console.log(chalk.red(`  ${inj.player}: ${inj.injury}`));
      }
      console.log();
    } else if (viewMode === 'scoring') {
      console.log(chalk.bold.yellow('SCORING SUMMARY\n'));
      for (const event of scoringSummary) {
        const description = logger.describeEvent(event as any, teamNames);
        if (event.type === 'fieldGoal' && (event as any).made) {
          console.log(chalk.green(description));
        } else if (event.type === 'extraPoint' && (event as any).made) {
          console.log(chalk.green(description));
        } else if ('td' in event && (event as any).td) {
          console.log(chalk.green(description));
        } else if ('safety' in event && (event as any).safety) {
          console.log(chalk.red(description));
        } else {
          console.log(description);
        }
      }
    } else {
      console.log(chalk.bold.yellow('PLAY-BY-PLAY\n'));
      for (const event of playByPlay) {
        const description = logger.describeEvent(event, teamNames);
        
        if (event.type === 'quarter') {
          console.log(chalk.cyan.bold(`\n${description}`));
        } else if (event.type === 'overtime') {
          console.log(chalk.magenta.bold(`\n${description}`));
        } else if (event.type === 'gameOver') {
          console.log(chalk.bold.green(`\n${description}`));
        } else if ('td' in event && (event as any).td) {
          console.log(chalk.green.bold(description));
        } else if ('made' in event && (event as any).made) {
          console.log(chalk.green(description));
        } else if ('safety' in event && (event as any).safety) {
          console.log(chalk.red.bold(description));
        } else {
          console.log(description);
        }
      }
    }
    console.log();
  }

  async viewFinances() {
    if (!this.userTeam) return;

    const teamPlayers = this.players.filter(p => p.tid === this.userTeam!.tid);
    const totalSalary = teamPlayers.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);

    const market = this.userTeam.market || 'medium';
    const pop = this.userTeam.pop;
    const won = this.userTeam.won;
    const lost = this.userTeam.lost;
    const winPct = won + lost > 0 ? won / (won + lost) : 0;

    const ticketPrice = 50;
    const avgAttendance = market === 'huge' ? 70000 : market === 'large' ? 55000 : market === 'medium' ? 40000 : 25000;
    const attendanceFactor = 0.5 + winPct * 0.5;
    const ticketSales = Math.round(ticketPrice * avgAttendance * attendanceFactor * 8 / 1000);

    const merchandiseBase = market === 'huge' ? 8000 : market === 'large' ? 5000 : market === 'medium' ? 3000 : 1500;
    const merchandise = Math.round(merchandiseBase * (0.5 + winPct * 0.5));

    const tvBase = market === 'huge' ? 30000 : market === 'large' ? 20000 : market === 'medium' ? 12000 : 6000;
    const tvRights = Math.round(tvBase);

    const sponsorBase = market === 'huge' ? 15000 : market === 'large' ? 10000 : market === 'medium' ? 6000 : 3000;
    const sponsorBonus = won * 200;
    const sponsorships = Math.round(sponsorBase + sponsorBonus);

    const prizeMoney = won * 500;

    const totalRevenue = ticketSales + merchandise + tvRights + sponsorships + prizeMoney;

    const signingBonuses = teamPlayers.reduce((sum, p) => sum + (p.contract?.signingBonus || 0), 0);
    const coachingBase = 5000;
    const facilities = 3000;
    const travel = 2000;
    const totalExpenses = totalSalary + signingBonuses + coachingBase + facilities + travel;

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Finances Menu:',
      choices: [
        { name: '📊 Overview', value: 'overview' },
        { name: '📈 Revenue Details', value: 'revenue' },
        { name: '📉 Expenses Details', value: 'expenses' },
        { name: '💵 Payroll', value: 'payroll' },
        { name: '← Back', value: 'back' }
      ]
    }]);

    switch (action) {
      case 'overview':
        this.displayFinanceOverview(totalRevenue, totalExpenses, totalSalary);
        break;
      case 'revenue':
        this.displayRevenueDetails(ticketSales, merchandise, tvRights, sponsorships, prizeMoney);
        break;
      case 'expenses':
        this.displayExpensesDetails(totalSalary, signingBonuses, coachingBase, facilities, travel);
        break;
      case 'payroll':
        await this.displayPayroll();
        break;
      case 'back':
        return;
    }
  }

  displayFinanceOverview(totalRevenue: number, totalExpenses: number, totalSalary: number) {
    const profit = totalRevenue - totalExpenses;
    const capSpace = this.userTeam!.budget - totalSalary;

    console.log(chalk.bold('\n💰 FINANCIAL OVERVIEW\n'));
    console.log(`Team: ${this.userTeam!.name} (${this.userTeam!.market || 'medium'} market)`);
    console.log(`Season: ${this.seasonYear} | Record: ${this.userTeam!.won}-${this.userTeam!.lost}\n`);

    const table = new Table({
      head: ['Category', 'Amount (k)'],
      colWidths: [25, 15]
    });

    table.push(
      ['Total Revenue', chalk.green(`+$${totalRevenue}`)],
      ['Total Expenses', chalk.red(`-$${totalExpenses}`)],
      ['Net Profit/Loss', profit >= 0 ? chalk.green(`+$${profit}`) : chalk.red(`-$${Math.abs(profit)}`)],
      ['─'.repeat(20), '─'.repeat(10)],
      ['Budget Cap', `$${this.userTeam!.budget}`],
      ['Current Payroll', `$${totalSalary}`],
      ['Cap Space', capSpace >= 0 ? chalk.green(`$${capSpace}`) : chalk.red(`-$${Math.abs(capSpace)}`)],
      ['Cash on Hand', chalk.cyan(`$${this.userTeam!.cash}`)]
    );

    console.log(table.toString());
    console.log();
  }

  displayRevenueDetails(
    ticketSales: number,
    merchandise: number,
    tvRights: number,
    sponsorships: number,
    prizeMoney: number
  ) {
    const total = ticketSales + merchandise + tvRights + sponsorships + prizeMoney;

    console.log(chalk.bold('\n📈 REVENUE DETAILS\n'));

    const table = new Table({
      head: ['Source', 'Amount (k)', '% of Total'],
      colWidths: [25, 15, 12]
    });

    table.push(
      ['🎫 Ticket Sales', chalk.green(`+$${ticketSales}`), `${Math.round(ticketSales / total * 100)}%`],
      ['👕 Merchandise', chalk.green(`+$${merchandise}`), `${Math.round(merchandise / total * 100)}%`],
      ['📺 TV Rights', chalk.green(`+$${tvRights}`), `${Math.round(tvRights / total * 100)}%`],
      ['🤝 Sponsorships', chalk.green(`+$${sponsorships}`), `${Math.round(sponsorships / total * 100)}%`],
      ['🏆 Prize Money', chalk.green(`+$${prizeMoney}`), `${Math.round(prizeMoney / total * 100)}%`],
      ['─'.repeat(20), '─'.repeat(10), '─'.repeat(8)],
      ['TOTAL', chalk.green.bold(`+$${total}`), '100%']
    );

    console.log(table.toString());
    console.log();
  }

  displayExpensesDetails(
    salary: number,
    signingBonuses: number,
    coaching: number,
    facilities: number,
    travel: number
  ) {
    const total = salary + signingBonuses + coaching + facilities + travel;

    console.log(chalk.bold('\n📉 EXPENSE DETAILS\n'));

    const table = new Table({
      head: ['Category', 'Amount (k)', '% of Total'],
      colWidths: [25, 15, 12]
    });

    table.push(
      ['💰 Player Salaries', chalk.red(`-$${salary}`), `${Math.round(salary / total * 100)}%`],
      ['✍️  Signing Bonuses', chalk.red(`-$${signingBonuses}`), `${Math.round(signingBonuses / total * 100)}%`],
      ['👔 Coaching Staff', chalk.red(`-$${coaching}`), `${Math.round(coaching / total * 100)}%`],
      ['🏟️  Facilities', chalk.red(`-$${facilities}`), `${Math.round(facilities / total * 100)}%`],
      ['✈️  Travel', chalk.red(`-$${travel}`), `${Math.round(travel / total * 100)}%`],
      ['─'.repeat(20), '─'.repeat(10), '─'.repeat(8)],
      ['TOTAL', chalk.red.bold(`-$${total}`), '100%']
    );

    console.log(table.toString());
    console.log();
  }

  async displayPayroll() {
    if (!this.userTeam) return;

    const teamPlayers = this.players
      .filter(p => p.tid === this.userTeam!.tid && p.contract)
      .sort((a, b) => (b.contract?.amount || 0) - (a.contract?.amount || 0));

    console.log(chalk.bold('\n💵 PAYROLL BREAKDOWN\n'));

    const table = new Table({
      head: ['Player', 'Pos', 'Salary', 'Years', 'Signing Bonus'],
      colWidths: [25, 6, 12, 8, 15]
    });

    teamPlayers.slice(0, 20).forEach(p => {
      table.push([
        p.name,
        chalk.cyan(p.pos),
        `$${p.contract?.amount}k`,
        p.contract?.years?.toString() || '-',
        `$${p.contract?.signingBonus || 0}k`
      ]);
    });

    console.log(table.toString());

    const totalSalary = teamPlayers.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
    const totalBonuses = teamPlayers.reduce((sum, p) => sum + (p.contract?.signingBonus || 0), 0);

    console.log(`\nTotal: ${teamPlayers.length} players | Salary: $${totalSalary}k | Bonuses: $${totalBonuses}k\n`);
  }

  async tradeMenu() {
    if (!this.userTeam) return;

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Trade Menu:',
      choices: [
        { name: '🔄 Make a Trade', value: 'make' },
        { name: '📋 View Trade History', value: 'history' },
        { name: '← Back', value: 'back' }
      ]
    }]);

    switch (action) {
      case 'make':
        await this.makeTrade();
        break;
      case 'history':
        console.log(chalk.yellow('\nTrade history coming soon!\n'));
        break;
      case 'back':
        return;
    }
  }

  async makeTrade() {
    if (!this.userTeam) return;

    const otherTeams = this.teams.filter(t => t.tid !== this.userTeam!.tid && t.region === this.userTeam!.region);
    
    const teamChoices = otherTeams.map(t => ({
      name: `${t.name} (${t.strength || 'average'})`,
      value: t
    }));

    const { partnerTeam } = await inquirer.prompt([{
      type: 'list',
      name: 'partnerTeam',
      message: 'Select trade partner:',
      choices: teamChoices,
      pageSize: 15
    }]);

    const myPlayers = this.players.filter(p => p.tid === this.userTeam!.tid && isPlayerTradable(p));
    const theirPlayers = this.players.filter(p => p.tid === partnerTeam.tid && isPlayerTradable(p));

    if (myPlayers.length === 0) {
      console.log(chalk.yellow('\nNo tradable players on your roster.\n'));
      return;
    }

    const myPlayerChoices = myPlayers
      .sort((a, b) => b.ovr - a.ovr)
      .map(p => ({
        name: `${p.name} (${p.pos}, OVR ${p.ovr}) - Value: ${calculatePlayerValue(p)}`,
        value: p
      }));

    const { mySelectedPlayers } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'mySelectedPlayers',
      message: 'Select players to trade away:',
      choices: myPlayerChoices,
      pageSize: 15
    }]);

    if (mySelectedPlayers.length === 0) {
      console.log(chalk.yellow('\nNo players selected.\n'));
      return;
    }

    const theirPlayerChoices = theirPlayers
      .sort((a, b) => b.ovr - a.ovr)
      .map(p => ({
        name: `${p.name} (${p.pos}, OVR ${p.ovr}) - Value: ${calculatePlayerValue(p)}`,
        value: p
      }));

    const { theirSelectedPlayers } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'theirSelectedPlayers',
      message: 'Select players to receive:',
      choices: theirPlayerChoices,
      pageSize: 15
    }]);

    if (theirSelectedPlayers.length === 0) {
      console.log(chalk.yellow('\nNo players selected.\n'));
      return;
    }

    const fromAssets: TradeAsset[] = mySelectedPlayers.map((p: Player) => createTradeAsset('player', p));
    const toAssets: TradeAsset[] = theirSelectedPlayers.map((p: Player) => createTradeAsset('player', p));

    const proposal: TradeProposal = {
      fromTeam: this.userTeam.tid,
      toTeam: partnerTeam.tid,
      fromAssets,
      toAssets,
      status: 'pending'
    };

    const evaluation = evaluateTrade(proposal);

    console.log(chalk.bold('\n📊 Trade Evaluation\n'));
    console.log(`Your offer value: ${chalk.cyan(evaluation.fromValue)}`);
    console.log(`Their offer value: ${chalk.cyan(evaluation.toValue)}`);
    
    if (evaluation.fair) {
      console.log(chalk.green('Trade is considered FAIR'));
    } else {
      if (evaluation.fromValue < evaluation.toValue) {
        console.log(chalk.yellow('Trade favors YOU - AI may reject'));
      } else {
        console.log(chalk.yellow('Trade favors THEM - AI likely to accept'));
      }
    }

    console.log(chalk.bold('\n📦 Players You Send:'));
    mySelectedPlayers.forEach((p: Player) => {
      console.log(`  ${p.name} (${p.pos}, OVR ${p.ovr})`);
    });

    console.log(chalk.bold('\n📦 Players You Receive:'));
    theirSelectedPlayers.forEach((p: Player) => {
      console.log(`  ${p.name} (${p.pos}, OVR ${p.ovr})`);
    });

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Propose this trade?',
      default: false
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\nTrade cancelled.\n'));
      return;
    }

    const aiAccepts = shouldAcceptTrade(proposal, true);

    if (aiAccepts) {
      proposal.status = 'accepted';
      executeTrade(proposal, this.players, []);
      
      console.log(chalk.green.bold('\n✅ TRADE ACCEPTED!\n'));
      console.log(`Trade completed with ${partnerTeam.name}\n`);
    } else {
      console.log(chalk.red.bold('\n❌ TRADE REJECTED!\n'));
      console.log(`${partnerTeam.name} declined your offer.\n`);
    }
  }

  async freeAgencyMenu() {
    if (!this.userTeam) return;

    if (this.freeAgents.length === 0) {
      this.freeAgents = generateFreeAgentPool([], 50, this.seasonYear);
    }

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Free Agency Menu:',
      choices: [
        { name: '📋 Browse Free Agents', value: 'browse' },
        { name: '✍️  Sign a Player', value: 'sign' },
        { name: '← Back', value: 'back' }
      ]
    }]);

    switch (action) {
      case 'browse':
        await this.browseFreeAgents();
        break;
      case 'sign':
        await this.signFreeAgentMenu();
        break;
      case 'back':
        return;
    }
  }

  async browseFreeAgents() {
    const table = new Table({
      head: ['Pos', 'Name', 'Age', 'Ovr', 'Pot', 'Min Salary', 'Min Years'],
      colWidths: [6, 25, 6, 6, 6, 12, 10]
    });

    const freeAgentsWithDemands = this.freeAgents.slice(0, 30).map(p => {
      const demand = generateContractDemand(p);
      return { player: p, demand };
    });

    freeAgentsWithDemands.forEach(({ player, demand }) => {
      table.push([
        chalk.cyan(player.pos),
        player.name,
        player.age,
        player.ovr,
        player.pot,
        `$${demand.minSalary}k`,
        `${demand.minYears} yr`
      ]);
    });

    console.log(`\n${chalk.bold('📋 Available Free Agents (Top 30)')}\n`);
    console.log(table.toString());
    console.log();
  }

  async signFreeAgentMenu() {
    if (!this.userTeam) return;

    if (this.freeAgents.length === 0) {
      console.log(chalk.yellow('\nNo free agents available. Generating pool...\n'));
      this.freeAgents = generateFreeAgentPool([], 50, this.seasonYear);
    }

    type ChoiceType = { name: string; value: { player: Player; demand: FreeAgentDemand } | 'back'; short?: string };
    const choices: ChoiceType[] = this.freeAgents
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 30)
      .map(p => {
        const demand = generateContractDemand(p);
        return {
          name: `${p.name} (${p.pos}, OVR ${p.ovr}) - Wants: $${demand.minSalary}k/${demand.minYears}yr`,
          value: { player: p, demand } as const,
          short: p.name
        };
      });

    choices.push({ name: chalk.gray('← Back'), value: 'back', short: 'Back' });

    const { selected } = await inquirer.prompt([{
      type: 'list',
      name: 'selected',
      message: 'Select a player to sign:',
      choices,
      pageSize: 15
    }]);

    if (selected === 'back') {
      return;
    }

    const { player, demand } = selected;

    console.log(chalk.bold(`\n📋 ${player.name}\n`));
    console.log(`Position: ${player.pos}`);
    console.log(`Age: ${player.age}`);
    console.log(`Overall: ${player.ovr}`);
    console.log(`Potential: ${player.pot}`);
    console.log(`\nContract Demands:`);
    console.log(`  Minimum Salary: $${demand.minSalary}k/year`);
    console.log(`  Minimum Years: ${demand.minYears}`);

    const teamPlayers = this.players.filter(p => p.tid === this.userTeam!.tid);
    const currentPayroll = teamPlayers.reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
    const capSpace = this.userTeam.budget - currentPayroll;

    console.log(`\nYour Cap Space: ${capSpace >= demand.minSalary ? chalk.green(`$${capSpace}k`) : chalk.red(`$${capSpace}k`)}\n`);

    const { salary } = await inquirer.prompt([{
      type: 'number',
      name: 'salary',
      message: `Enter annual salary (k):`,
      default: demand.minSalary,
      validate: (val) => val > 0 ? true : 'Salary must be positive'
    }]);

    const { years } = await inquirer.prompt([{
      type: 'number',
      name: 'years',
      message: 'Enter contract length (years):',
      default: demand.minYears,
      validate: (val) => val >= 1 && val <= 5 ? true : 'Years must be 1-5'
    }]);

    if (salary > capSpace) {
      console.log(chalk.red('\nWarning: This signing would exceed your salary cap!\n'));
    }

    console.log(chalk.bold('\n📝 Contract Summary\n'));
    console.log(`Player: ${player.name}`);
    console.log(`Annual Salary: $${salary}k`);
    console.log(`Years: ${years}`);
    console.log(`Total Value: $${salary * years}k`);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Sign this player?',
      default: true
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\nSigning cancelled.\n'));
      return;
    }

    const result = evaluateOffer(player, demand, {
      salary,
      years,
      team: this.userTeam
    });

    if (result.accepted) {
      signFreeAgent(player, this.userTeam, salary, years, this.seasonYear);
      this.players.push(player);
      this.freeAgents = this.freeAgents.filter(p => p.pid !== player.pid);

      console.log(chalk.green.bold(`\n✅ ${player.name} signed!\n`));
      console.log(`Contract: $${salary}k/year for ${years} years\n`);
    } else {
      console.log(chalk.red.bold(`\n❌ ${result.reason}\n`));
    }
  }

  async draftMenu() {
    if (!this.userTeam || !this.season) return;

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Draft Menu:',
      choices: [
        { name: '📋 View Draft Board', value: 'view' },
        { name: '🎯 Make Selection', value: 'select' },
        { name: '⚡ Sim Round', value: 'simround' },
        { name: '⚡ Sim Entire Draft', value: 'simall' },
        { name: '← Back', value: 'back' }
      ]
    }]);

    switch (action) {
      case 'view':
        await this.viewDraftBoard();
        break;
      case 'select':
        await this.makeDraftSelection();
        break;
      case 'simround':
        await this.simDraftRound();
        break;
      case 'simall':
        await this.simEntireDraft();
        break;
      case 'back':
        return;
    }
  }

  async viewDraftBoard() {
    if (this.draftProspects.length === 0) {
      this.draftProspects = generateDraftPool(this.seasonYear, 224);
    }

    const table = new Table({
      head: ['Rank', 'Name', 'Pos', 'OVR', 'POT', 'Proj Rd', '40yd'],
      colWidths: [6, 25, 6, 6, 6, 8, 8]
    });

    this.draftProspects
      .filter(p => p.tid === undefined)
      .slice(0, 50)
      .forEach((p, i) => {
        table.push([
          (i + 1).toString(),
          p.name,
          chalk.cyan(p.pos),
          p.ovr,
          p.pot,
          `Rd ${p.projectedRound}`,
          `${p.combineResults.fortyTime.toFixed(2)}s`
        ]);
      });

    console.log(`\n${chalk.bold('📋 Draft Board (Top 50 Available)')}\n`);
    console.log(table.toString());
    console.log();
  }

  async makeDraftSelection() {
    if (!this.userTeam || !this.season) return;

    if (this.draftProspects.length === 0) {
      this.draftProspects = generateDraftPool(this.seasonYear, 224);
    }

    const availableProspects = this.draftProspects.filter(p => p.tid === undefined);

    if (availableProspects.length === 0) {
      console.log(chalk.yellow('\nNo prospects available in the draft pool.\n'));
      return;
    }

    const choices = availableProspects.slice(0, 50).map((p, i) => ({
      name: `${i + 1}. ${p.name} (${p.pos}, OVR ${p.ovr}, POT ${p.pot}) - Proj Rd ${p.projectedRound}`,
      value: p
    }));

    const { prospect } = await inquirer.prompt([{
      type: 'list',
      name: 'prospect',
      message: 'Select a player to draft:',
      choices,
      pageSize: 15
    }]);

    console.log(chalk.bold(`\n📋 ${prospect.name}\n`));
    console.log(`Position: ${prospect.pos}`);
    console.log(`Age: ${prospect.age}`);
    console.log(`Overall: ${prospect.ovr}`);
    console.log(`Potential: ${prospect.pot}`);
    console.log(`\nCombine Results:`);
    console.log(`  40-yard Dash: ${prospect.combineResults.fortyTime.toFixed(2)}s`);
    console.log(`  Bench Press: ${prospect.combineResults.benchPress} reps`);
    console.log(`  Vertical Jump: ${prospect.combineResults.verticalJump.toFixed(1)}"`);
    console.log(`  Broad Jump: ${prospect.combineResults.broadJump}"`);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Draft this player?',
      default: true
    }]);

    if (confirm) {
      const pick = {
        dpid: Date.now(),
        tid: this.userTeam.tid,
        originalTid: this.userTeam.tid,
        round: 1,
        pick: 1,
        season: this.seasonYear
      };

      selectPlayer(this.userTeam.tid, prospect, pick, this.seasonYear);
      this.players.push(prospect);

      console.log(chalk.green.bold(`\n✅ ${prospect.name} drafted!\n`));
      console.log(`Contract: $${prospect.contract?.amount}k for ${prospect.contract?.years} years\n`);
    }
  }

  async simDraftRound() {
    if (!this.userTeam) return;

    if (this.draftProspects.length === 0) {
      this.draftProspects = generateDraftPool(this.seasonYear, 224);
    }

    const spinner = ora('Simulating draft round...').start();

    const teams = this.teams.filter(t => t.region === this.userTeam!.region);
    const availableProspects = this.draftProspects.filter(p => p.tid === undefined);

    for (const team of teams) {
      const prospect = availableProspects.shift();
      if (prospect) {
        const pick = {
          dpid: Date.now() + team.tid,
          tid: team.tid,
          originalTid: team.tid,
          round: 1,
          pick: teams.indexOf(team) + 1,
          season: this.seasonYear
        };
        selectPlayer(team.tid, prospect, pick, this.seasonYear);
        this.players.push(prospect);
      }
    }

    spinner.succeed(`Round simulated! ${teams.length} players drafted.`);
    console.log();
  }

  async simEntireDraft() {
    if (!this.userTeam) return;

    if (this.draftProspects.length === 0) {
      this.draftProspects = generateDraftPool(this.seasonYear, 224);
    }

    const spinner = ora('Simulating entire draft (7 rounds)...').start();

    const teams = this.teams.filter(t => t.region === this.userTeam!.region);
    const availableProspects = this.draftProspects.filter(p => p.tid === undefined);
    let drafted = 0;

    for (let round = 1; round <= 7; round++) {
      for (const team of teams) {
        const prospect = availableProspects.shift();
        if (prospect) {
          const pick = {
            dpid: Date.now() + round * 1000 + team.tid,
            tid: team.tid,
            originalTid: team.tid,
            round,
            pick: teams.indexOf(team) + 1,
            season: this.seasonYear
          };
          selectPlayer(team.tid, prospect, pick, this.seasonYear);
          this.players.push(prospect);
          drafted++;
        }
      }
    }

    spinner.succeed(`Draft complete! ${drafted} players drafted across 7 rounds.`);
    console.log();
  }

  async viewStats() {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Stats Menu:',
      choices: [
        { name: '👥 Team Roster Stats', value: 'roster' },
        { name: '🏆 League Leaders', value: 'leaders' },
        { name: '📊 Team Stats', value: 'team' },
        { name: '← Back', value: 'back' }
      ]
    }]);

    switch (action) {
      case 'roster':
        await this.viewRosterStats();
        break;
      case 'leaders':
        await this.viewLeagueLeaders();
        break;
      case 'team':
        await this.viewTeamStats();
        break;
      case 'back':
        return;
    }
  }

  async viewRosterStats() {
    if (!this.userTeam) return;

    const teamPlayers = this.players
      .filter(p => p.tid === this.userTeam!.tid)
      .sort((a, b) => b.ovr - a.ovr);

    const table = new Table({
      head: ['Pos', 'Name', 'Age', 'Ovr', 'Pot', 'Value'],
      colWidths: [6, 25, 6, 6, 6, 10]
    });

    teamPlayers.forEach(p => {
      const value = calculatePlayerValue(p);
      table.push([
        chalk.cyan(p.pos),
        p.name,
        p.age,
        p.ovr,
        p.pot,
        chalk.green(value)
      ]);
    });

    console.log(`\n${chalk.bold(this.userTeam.name)} - Roster Values\n`);
    console.log(table.toString());
    console.log();
  }

  async viewLeagueLeaders() {
    const region = this.userTeam?.region || 'firstContinent';
    const regionPlayers = this.players
      .filter(p => {
        const team = this.teams.find(t => t.tid === p.tid);
        return team?.region === region;
      })
      .sort((a, b) => b.ovr - a.ovr)
      .slice(0, 20);

    const table = new Table({
      head: ['Rank', 'Player', 'Team', 'Pos', 'Ovr', 'Age'],
      colWidths: [6, 25, 25, 6, 6, 6]
    });

    regionPlayers.forEach((p, i) => {
      const team = this.teams.find(t => t.tid === p.tid);
      const isUser = p.tid === this.userTeam?.tid;
      table.push([
        (i + 1).toString(),
        isUser ? chalk.green.bold(p.name) : p.name,
        isUser ? chalk.green.bold(team?.name || 'FA') : (team?.name || 'FA'),
        chalk.cyan(p.pos),
        p.ovr,
        p.age
      ]);
    });

    console.log(`\n${chalk.bold(`Top 20 Players - ${region}`)}\n`);
    console.log(table.toString());
    console.log();
  }

  async viewTeamStats() {
    if (!this.userTeam) return;

    const teamPlayers = this.players.filter(p => p.tid === this.userTeam!.tid);
    
    const avgOvr = teamPlayers.reduce((s, p) => s + p.ovr, 0) / teamPlayers.length;
    const avgAge = teamPlayers.reduce((s, p) => s + p.age, 0) / teamPlayers.length;
    const avgPot = teamPlayers.reduce((s, p) => s + p.pot, 0) / teamPlayers.length;
    const totalValue = teamPlayers.reduce((s, p) => s + calculatePlayerValue(p), 0);

    const positionGroups: Record<string, Player[]> = {};
    teamPlayers.forEach(p => {
      if (!positionGroups[p.pos]) positionGroups[p.pos] = [];
      positionGroups[p.pos].push(p);
    });

    const table = new Table({
      head: ['Position', 'Count', 'Avg OVR', 'Best Player'],
      colWidths: [10, 8, 10, 30]
    });

    const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
    positions.forEach(pos => {
      const players = positionGroups[pos] || [];
      if (players.length > 0) {
        const avgPosOvr = Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length);
        const best = players.sort((a, b) => b.ovr - a.ovr)[0];
        table.push([
          chalk.cyan(pos),
          players.length.toString(),
          avgPosOvr.toString(),
          `${best.name} (${best.ovr})`
        ]);
      }
    });

    console.log(chalk.bold(`\n📊 ${this.userTeam.name} - Team Statistics\n`));
    console.log(`Overall Rating: ${chalk.green.bold(Math.round(avgOvr))}`);
    console.log(`Average Age: ${avgAge.toFixed(1)}`);
    console.log(`Average Potential: ${Math.round(avgPot)}`);
    console.log(`Total Roster Value: ${chalk.green(totalValue)}\n`);

    console.log(chalk.bold('Position Breakdown:'));
    console.log(table.toString());
    console.log();
  }

  async viewInjuries() {
    const injuredPlayers = this.players.filter(
      p => p.tid === this.userTeam?.tid && p.injury && p.injury.gamesRemaining > 0
    );

    if (injuredPlayers.length === 0) {
      console.log(chalk.green('\nNo injured players on your roster.\n'));
      return;
    }

    const table = new Table({
      head: ['Player', 'Pos', 'Injury', 'Games Out', 'OVR Penalty'],
      colWidths: [25, 6, 25, 12, 12],
    });

    injuredPlayers.forEach(p => {
      table.push([
        p.name,
        chalk.cyan(p.pos),
        chalk.red(p.injury!.type),
        p.injury!.gamesRemaining.toString(),
        `-${p.injury!.ovr}`,
      ]);
    });

    console.log(chalk.bold.red(`\n🏥 Injured Players (${injuredPlayers.length})\n`));
    console.log(table.toString());
    console.log();
  }

  async imperialCupInfo() {
    const nextYear = getNextImperialCupYear(this.seasonYear);
    const yearsUntil = nextYear - this.seasonYear;

    console.log(chalk.bold.cyan('\n🏆 IMPERIAL CUP\n'));
    console.log(`The Imperial Cup is a cross-region tournament held every ${4} years.`);
    console.log(`Teams from all four regions compete for the ultimate prize.\n`);

    console.log(chalk.bold('Qualifying Teams:'));
    console.log(`  Origin Continent: 6 teams (top 2 from each of 3 leagues)`);
    console.log(`  First Continent: 4 teams`);
    console.log(`  Second Continent: 4 teams`);
    console.log(`  Mining Island: 2 teams`);
    console.log(`  Total: 16 teams\n`);

    console.log(chalk.bold.yellow(`Next Imperial Cup: ${nextYear} (${yearsUntil} seasons away)\n`));

    console.log(chalk.bold('Historical Champions:'));
    for (const h of IMPERIAL_CUP_HISTORY.slice(0, 5)) {
      console.log(`  ${h.season}: ${chalk.green(h.champion)} def. ${h.runnerUp} ${h.score}`);
    }
    console.log();
  }

  async imperialCupMenu() {
    if (!isImperialCupYear(this.seasonYear)) {
      await this.imperialCupInfo();
      return;
    }

    console.log(chalk.bold.cyan(`\n🏆 IMPERIAL CUP ${this.seasonYear}\n`));

    if (!this.imperialCup) {
      const { start } = await inquirer.prompt([{
        type: 'confirm',
        name: 'start',
        message: 'Start Imperial Cup tournament?',
        default: true,
      }]);

      if (!start) return;

      const standings = this.season?.getStandings() || [];
      const qualified = qualifyForImperialCup(this.teams, standings);
      const matches = generateImperialCupBracket(qualified);

      this.imperialCup = {
        season: this.seasonYear,
        qualifiedTeams: qualified,
        matches,
        completed: false,
      };

      console.log(chalk.green('\nImperial Cup tournament has begun!\n'));
    }

    const choices = [
      { name: '📋 View Bracket', value: 'bracket' },
      { name: '▶️  Simulate Round', value: 'simround' },
      { name: '🔙 Back', value: 'back' },
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Imperial Cup:',
      choices,
    }]);

    switch (action) {
      case 'bracket':
        this.viewImperialCupBracket();
        break;
      case 'simround':
        await this.simulateImperialCupRound();
        break;
      case 'back':
        return;
    }

    if (!this.imperialCup.completed) {
      await this.imperialCupMenu();
    }
  }

  viewImperialCupBracket() {
    if (!this.imperialCup) return;

    console.log(chalk.bold.cyan('\n🏆 IMPERIAL CUP BRACKET\n'));

    const roundMatches = this.imperialCup.matches.reduce((acc, m) => {
      if (!acc[m.round]) acc[m.round] = [];
      acc[m.round].push(m);
      return acc;
    }, {} as Record<string, ImperialCupMatch[]>);

    const roundOrder = ['roundOf16', 'quarterfinals', 'semifinals', 'final'];
    
    for (const round of roundOrder) {
      const matches = roundMatches[round];
      if (!matches || matches.length === 0) continue;

      console.log(chalk.bold(getRoundName(round as any)));
      
      for (const match of matches) {
        const home = this.teams.find(t => t.tid === match.homeTid);
        const away = this.teams.find(t => t.tid === match.awayTid);
        
        if (match.played) {
          const winner = this.teams.find(t => t.tid === match.winnerTid);
          console.log(`  ${match.homeScore} - ${match.awayScore} ${home?.name} vs ${away?.name} → ${chalk.green(winner?.name || 'TBD')}`);
        } else {
          console.log(`  ${home?.name} vs ${away?.name}`);
        }
      }
      console.log();
    }

    if (this.imperialCup.completed && this.imperialCup.champion) {
      const champ = this.teams.find(t => t.tid === this.imperialCup!.champion);
      console.log(chalk.bold.green(`🏆 CHAMPION: ${champ?.name}\n`));
    }
  }

  async simulateImperialCupRound() {
    if (!this.imperialCup || this.imperialCup.completed) return;

    const currentRoundMatches = this.imperialCup.matches.filter(m => !m.played);
    if (currentRoundMatches.length === 0) {
      console.log(chalk.yellow('\nAll rounds completed!\n'));
      return;
    }

    const spinner = ora(`Simulating ${getRoundName(currentRoundMatches[0].round)}...`).start();

    for (const match of currentRoundMatches) {
      const homePlayers = this.players.filter(p => p.tid === match.homeTid).slice(0, 25);
      const awayPlayers = this.players.filter(p => p.tid === match.awayTid).slice(0, 25);

      const homeTeam: TeamGameSim = {
        id: match.homeTid,
        stat: { pts: 0 },
        player: homePlayers.map(p => ({
          ...p,
          stat: {},
          compositeRating: calculateCompositeRatings(p),
          energy: 1,
          ptModifier: 1,
        })) as PlayerGameSim[],
        compositeRating: {} as any,
        depth: {} as any,
      };

      const awayTeam: TeamGameSim = {
        id: match.awayTid,
        stat: { pts: 0 },
        player: awayPlayers.map(p => ({
          ...p,
          stat: {},
          compositeRating: calculateCompositeRatings(p),
          energy: 1,
          ptModifier: 1,
        })) as PlayerGameSim[],
        compositeRating: {} as any,
        depth: {} as any,
      };

      const gameSim = new GameSim({
        gid: Math.random() * 1000000,
        teams: [homeTeam, awayTeam],
        quarterLength: 1,
        numPeriods: 4,
      });

      const result = gameSim.run();
      match.homeScore = result.teams[0].pts;
      match.awayScore = result.teams[1].pts;
      match.winnerTid = result.teams[0].pts > result.teams[1].pts ? match.homeTid : match.awayTid;
      match.played = true;
    }

    spinner.succeed(`${getRoundName(currentRoundMatches[0].round)} complete!`);

    const nextRound = advanceRound(this.imperialCup.matches);
    if (nextRound && nextRound.length > 0) {
      this.imperialCup.matches = [...this.imperialCup.matches, ...nextRound];
    } else if (currentRoundMatches[0].round === 'final') {
      this.imperialCup.completed = true;
      this.imperialCup.champion = currentRoundMatches[0].winnerTid;
      const champ = this.teams.find(t => t.tid === this.imperialCup!.champion);
      console.log(chalk.bold.green(`\n🏆 IMPERIAL CUP CHAMPION: ${champ?.name}!\n`));
    }

    this.viewImperialCupBracket();
  }

  async saveGameMenu() {
    if (!this.season || !this.userTeam) {
      console.log(chalk.yellow('\nNo game in progress to save.\n'));
      return;
    }

    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Enter save name:',
      default: `${this.userTeam.name} - Week ${this.season.currentWeek}`,
    }]);

    const spinner = ora('Saving game...').start();

    const saveData: SaveData = {
      teams: this.teams,
      players: this.players,
      freeAgents: this.freeAgents,
      seasonYear: this.seasonYear,
      currentWeek: this.season.currentWeek,
      schedule: this.season.schedule,
      standings: this.season.getStandings(),
      userTeamTid: this.userTeam.tid,
    };

    const save = saveGame(name, saveData);
    
    spinner.succeed(`Game saved: ${save.name}`);
    console.log(chalk.gray(`  ${formatDate(save.timestamp)}\n`));
  }

  async loadGameMenu() {
    const saves = listSaves();

    if (saves.length === 0) {
      console.log(chalk.yellow('\nNo saved games found.\n'));
      await this.mainMenu();
      return;
    }

    const choices = saves.map(s => ({
      name: `${s.name} - ${s.userTeamName} (Week ${s.currentWeek}) ${chalk.gray(formatDate(s.timestamp))}`,
      value: s.id,
    }));

    choices.push({ name: chalk.gray('← Back to Main Menu'), value: 'back' });

    const { saveId } = await inquirer.prompt([{
      type: 'list',
      name: 'saveId',
      message: 'Select a save to load:',
      choices,
      pageSize: 10,
    }]);

    if (saveId === 'back') {
      await this.mainMenu();
      return;
    }

    const spinner = ora('Loading game...').start();

    const save = loadGame(saveId);
    if (!save) {
      spinner.fail('Failed to load save');
      await this.mainMenu();
      return;
    }

    this.teams = save.data.teams as Team[];
    this.players = save.data.players as Player[];
    this.freeAgents = save.data.freeAgents || [];
    this.seasonYear = save.data.seasonYear;
    this.season = new SeasonManager(this.seasonYear, this.teams);
    this.season.startRegularSeason();
    this.season.currentWeek = save.data.currentWeek;
    this.season.schedule = save.data.schedule;
    this.userTeam = this.teams.find(t => t.tid === save.data.userTeamTid) || null;

    spinner.succeed(`Loaded: ${save.name}`);
    console.log(chalk.green(`\nWelcome back, GM of ${this.userTeam?.name}!\n`));
    console.log(`Week ${this.season.currentWeek} | Season ${this.seasonYear}\n`);

    await this.gameMenu();
  }
}

const game = new SIFINFLGame();
game.init().catch(console.error);
