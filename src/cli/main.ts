/**
 * SIFI NFL CLI Game
 * Refactored to use GameEngine API (shared with Web UI)
 */

import {
  getGameEngine,
  resetGameEngine,
  type GameResult,
  type StandingEntry,
  type DraftProspect,
  type ScoringEvent,
  type PenaltySummary,
  type InjurySummary,
  type PlayByPlayEvent,
} from '../worker/api';
import type { Team, Player } from '@common/entities';
import type { Region } from '@common/types';
import { listSaves, saveGame, loadGame, formatDate, type SaveData } from './saveManager';
import chalk from 'chalk';
import Table from 'cli-table3';
import inquirer from 'inquirer';
import ora from 'ora';

type LastGameInfo = {
  playByPlay: PlayByPlayEvent[];
  scoringSummary: ScoringEvent[];
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  penalties?: PenaltySummary[];
  injuries?: InjurySummary[];
};

class SIFINFLGame {
  private engine = getGameEngine();
  private lastGameInfo: LastGameInfo | null = null;

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
    const spinner = ora('Initializing game engine...').start();

    // Get region selection first
    const regionNames: Record<string, string> = {
      firstContinent: '🌍 First Continent (36 teams, closed league)',
      secondContinent: '🌎 Second Continent (40 teams, closed league)',
      originContinent: '🏛️  Origin Continent (3 leagues, promotion/relegation)',
      miningIsland: '⛏️  Mining Island (4-tier pyramid, 58 teams)',
    };

    spinner.stop();

    const { region } = await inquirer.prompt([{
      type: 'list',
      name: 'region',
      message: 'Select your region:',
      choices: Object.entries(regionNames).map(([key, name]) => ({
        name,
        value: key
      }))
    }]) as { region: Region };

    // Handle sub-region selection
    let selectedLeague: string | undefined;
    let selectedTier: number | undefined;

    if (region === 'originContinent') {
      const { league } = await inquirer.prompt([{
        type: 'list',
        name: 'league',
        message: 'Select your league:',
        choices: [
          { name: '🏛️  Metropolis League', value: 'metropolis' },
          { name: '👑 Imperial League', value: 'imperial' },
          { name: '🏰 Royal League', value: 'royal' }
        ]
      }]);
      selectedLeague = league;
    }

    if (region === 'miningIsland') {
      const { tier } = await inquirer.prompt([{
        type: 'list',
        name: 'tier',
        message: 'Select your tier:',
        choices: [
          { name: '⭐ Super League (Top Tier)', value: 1 },
          { name: '🥈 Championship (2nd Tier)', value: 2 },
          { name: '🥉 A League (3rd Tier)', value: 3 },
          { name: '⛏️  B League (4th Tier - Amateur)', value: 4 }
        ]
      }]);
      selectedTier = tier;
    }

    spinner.start('Generating universe...');

    // Get teams for selection
    const state = this.engine.getState();
    const regionTeams = state.teams.filter(t => t.region === region);

    // Filter by league/tier if needed
    let availableTeams = regionTeams;
    if (selectedLeague) {
      const leagueIndex = { metropolis: 0, imperial: 1, royal: 2 }[selectedLeague] || 0;
      const teamsPerLeague = Math.ceil(regionTeams.length / 3);
      availableTeams = regionTeams.slice(leagueIndex * teamsPerLeague, (leagueIndex + 1) * teamsPerLeague);
    }
    if (selectedTier) {
      const teamsPerTier = Math.ceil(regionTeams.length / 4);
      availableTeams = regionTeams.slice((selectedTier - 1) * teamsPerTier, selectedTier * teamsPerTier);
    }

    spinner.stop();

    // Team selection
    const marketIcons: Record<string, string> = {
      huge: '💰💰💰',
      large: '💰💰',
      medium: '💰',
      small: ''
    };
    const strengthIcons: Record<string, string> = {
      elite: '⭐⭐⭐',
      strong: '⭐⭐',
      average: '⭐',
      weak: ''
    };

    const { teamId } = await inquirer.prompt([{
      type: 'list',
      name: 'teamId',
      message: 'Select your team:',
      choices: availableTeams.map(t => ({
        name: `${t.name} ${marketIcons[t.pop || ''] || ''} ${strengthIcons[t.strength || ''] || ''}`.trim(),
        value: t.tid
      })),
      pageSize: 15
    }]);

    // Initialize game with selected team
    spinner.start('Starting new game...');

    await this.engine.newGame({
      region,
      teamId,
      season: 2025,
    });

    spinner.succeed(`Game initialized! You are managing ${this.engine.getUserTeam()?.name}`);

    await this.gameMenu();
  }

  async loadGameMenu() {
    const saves = await this.engine.listSaves();

    if (saves.length === 0) {
      console.log(chalk.yellow('\nNo saved games found.\n'));
      return this.mainMenu();
    }

    const { saveId } = await inquirer.prompt([{
      type: 'list',
      name: 'saveId',
      message: 'Select a save to load:',
      choices: saves.map(s => ({
        name: `${s.name} - ${formatDate(s.timestamp)}`,
        value: s.name
      }))
    }]);

    const spinner = ora('Loading game...').start();

    try {
      await this.engine.loadGame(saveId);
      spinner.succeed(`Loaded: ${this.engine.getUserTeam()?.name}`);
      await this.gameMenu();
    } catch (error) {
      spinner.fail('Failed to load game');
      console.error(error);
      await this.mainMenu();
    }
  }

  async gameMenu() {
    const state = this.engine.getState();
    const userTeam = this.engine.getUserTeam();

    if (!userTeam) {
      console.log(chalk.red('No team selected!'));
      return this.mainMenu();
    }

    console.log(chalk.cyan.bold(`\n═══════════════════════════════════════════════════════════`));
    console.log(chalk.cyan.bold(`  ${userTeam.name}`));
    console.log(chalk.cyan.bold(`  Season ${state.season} | Week ${state.week} | ${userTeam.won}-${userTeam.lost}`));
    console.log(chalk.cyan.bold(`═══════════════════════════════════════════════════════════\n`));

    const choices = [
      { name: '🏈 View Roster', value: 'roster' },
      { name: '📅 View Schedule', value: 'schedule' },
      { name: '🏆 Standings', value: 'standings' },
      { name: '▶️  Play Week', value: 'play' },
      { name: '⚡ Sim Week', value: 'sim' },
      { name: '📝 View Play-by-Play', value: 'playByPlay', disabled: !this.lastGameInfo },
      { name: '💰 Finances', value: 'finances' },
      { name: '🔄 Trade', value: 'trade' },
      { name: '📋 Free Agency', value: 'freeAgency' },
      { name: '🎯 Draft', value: 'draft' },
      { name: '📈 Stats', value: 'stats' },
      { name: '🏥 Injuries', value: 'injuries' },
      { name: '📅 Offseason', value: 'offseason' },
      { name: '💾 Save Game', value: 'save' },
      { name: '🔙 Main Menu', value: 'back' }
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Game Menu:',
      choices
    }]);

    switch (action) {
      case 'roster': await this.viewRoster(); break;
      case 'schedule': await this.viewSchedule(); break;
      case 'standings': await this.viewStandings(); break;
      case 'play': await this.playWeek(); break;
      case 'sim': await this.simWeek(); break;
      case 'playByPlay': await this.viewPlayByPlay(); break;
      case 'finances': await this.viewFinances(); break;
      case 'trade': await this.tradeMenu(); break;
      case 'freeAgency': await this.freeAgencyMenu(); break;
      case 'draft': await this.draftMenu(); break;
      case 'stats': await this.viewStats(); break;
      case 'injuries': await this.viewInjuries(); break;
      case 'offseason': await this.offseasonMenu(); break;
      case 'save': await this.saveGameMenu(); break;
      case 'back': await this.mainMenu(); return;
    }

    await this.gameMenu();
  }

  async viewRoster() {
    const userTeam = this.engine.getUserTeam();
    const players = this.engine.getPlayers({ tid: userTeam?.tid });

    console.log(chalk.cyan.bold('\n=== Roster ===\n'));

    const table = new Table({
      head: ['Pos', 'Name', 'Age', 'OVR', 'POT', 'Salary'],
      colWidths: [6, 20, 6, 6, 6, 12]
    });

    const sorted = [...players].sort((a, b) => {
      const posOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'];
      return posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos);
    });

    for (const p of sorted) {
      table.push([
        p.pos,
        p.name,
        p.age.toString(),
        (p.ovr || 0).toString(),
        (p.pot || 0).toString(),
        `$${((p.contract?.amount || 0) / 1000).toFixed(0)}K`
      ]);
    }

    console.log(table.toString());
  }

  async viewSchedule() {
    const schedule = this.engine.getSchedule();
    const userTeam = this.engine.getUserTeam();

    const myGames = schedule.filter(
      g => g.homeTid === userTeam?.tid || g.awayTid === userTeam?.tid
    );

    console.log(chalk.cyan.bold('\n=== Schedule ===\n'));

    const table = new Table({
      head: ['Week', 'Opponent', 'Result'],
      colWidths: [8, 30, 15]
    });

    for (const game of myGames) {
      const isHome = game.homeTid === userTeam?.tid;
      const opp = this.engine.getTeam(isHome ? game.awayTid : game.homeTid);
      const result = game.played
        ? (game.won?.tid === userTeam?.tid ? 'W' : 'L') + ` ${game.won?.pts}-${game.lost?.pts}`
        : '-';

      table.push([
        `Week ${game.day}`,
        `${isHome ? 'vs' : '@'} ${opp?.name || 'Unknown'}`,
        result
      ]);
    }

    console.log(table.toString());
  }

  async viewStandings() {
    const standings = this.engine.getStandings();
    const userTeam = this.engine.getUserTeam();

    console.log(chalk.cyan.bold('\n=== Standings ===\n'));

    const myRegion = standings.filter(s => s.region === userTeam?.region);

    const table = new Table({
      head: ['#', 'Team', 'W', 'L', 'PCT', 'PF', 'PA'],
      colWidths: [4, 25, 4, 4, 8, 6, 6]
    });

    const sorted = [...myRegion].sort((a, b) => b.winPct - a.winPct);

    sorted.forEach((s, idx) => {
      const isUser = s.tid === userTeam?.tid;
      const team = this.engine.getTeam(s.tid);
      table.push([
        (idx + 1).toString(),
        isUser ? chalk.green(team?.name || 'Unknown') : (team?.name || 'Unknown'),
        s.won.toString(),
        s.lost.toString(),
        s.winPct.toFixed(3),
        s.pts.toString(),
        s.oppPts.toString()
      ]);
    });

    console.log(table.toString());
  }

  async playWeek() {
    const spinner = ora('Playing week...').start();

    try {
      const result = await this.engine.playWeek();
      spinner.stop();

      if (result) {
        const userTeam = this.engine.getUserTeam();
        const won = result.winner === userTeam?.tid;

        console.log(chalk.bold(`\n${result.awayTeam} vs ${result.homeTeam}`));
        console.log(chalk.bold(`Final: ${result.homeScore} - ${result.awayScore}`));
        console.log(won ? chalk.green.bold('🎉 Victory!') : chalk.red.bold('Defeat'));
      } else {
        console.log(chalk.yellow('No game this week or season complete.'));
      }
    } catch (error) {
      spinner.fail('Error playing week');
      console.error(error);
    }
  }

  async simWeek() {
    const spinner = ora('Simulating week...').start();

    try {
      await this.engine.simWeek();
      spinner.succeed('Week simulated');
    } catch (error) {
      spinner.fail('Error simulating week');
      console.error(error);
    }
  }

  async viewPlayByPlay() {
    if (!this.lastGameInfo) {
      console.log(chalk.yellow('\nNo game to display.\n'));
      return;
    }

    console.log(chalk.cyan.bold(`\n=== Play-by-Play ===`));
    console.log(chalk.bold(`${this.lastGameInfo.awayTeam} vs ${this.lastGameInfo.homeTeam}`));
    console.log(chalk.bold(`Final: ${this.lastGameInfo.awayScore} - ${this.lastGameInfo.homeScore}\n`));

    for (const event of this.lastGameInfo.scoringSummary) {
      console.log(chalk.yellow(`${event.time} - ${event.team}: ${event.type} (${event.points} pts)`));
    }
  }

  async viewFinances() {
    const userTeam = this.engine.getUserTeam();
    const finances = this.engine.getTeamFinances(userTeam?.tid || 0);

    console.log(chalk.cyan.bold('\n=== Finances ===\n'));

    console.log(`Budget: $${((userTeam?.budget || 0) / 1000000).toFixed(1)}M`);
    console.log(`Cash: $${((userTeam?.cash || 0) / 1000000).toFixed(1)}M`);
    console.log(`Payroll: $${((finances.payroll) / 1000000).toFixed(1)}M`);
    console.log(`Cap Space: $${((finances.capSpace) / 1000000).toFixed(1)}M`);
  }

  async tradeMenu() {
    console.log(chalk.yellow('\nTrade system - use Web UI for full functionality.\n'));
  }

  async freeAgencyMenu() {
    const freeAgents = this.engine.getFreeAgents();

    console.log(chalk.cyan.bold('\n=== Free Agents ===\n'));

    const table = new Table({
      head: ['Name', 'Pos', 'Age', 'OVR', 'Asking'],
      colWidths: [20, 6, 6, 6, 12]
    });

    const topFreeAgents = freeAgents
      .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))
      .slice(0, 20);

    for (const p of topFreeAgents) {
      const demand = this.engine.getContractDemand(p.pid);
      table.push([
        p.name,
        p.pos,
        p.age.toString(),
        (p.ovr || 0).toString(),
        `$${((demand.minSalary) / 1000).toFixed(0)}K`
      ]);
    }

    console.log(table.toString());
  }

  async draftMenu() {
    const prospects = this.engine.getDraftProspects();

    console.log(chalk.cyan.bold('\n=== Draft Board ===\n'));

    const table = new Table({
      head: ['Name', 'Pos', 'Age', 'OVR', 'POT'],
      colWidths: [20, 6, 6, 6, 6]
    });

    const topProspects = prospects
      .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))
      .slice(0, 20);

    for (const p of topProspects) {
      table.push([
        p.name,
        p.pos,
        p.age.toString(),
        (p.ovr || 0).toString(),
        (p.pot || 0).toString()
      ]);
    }

    console.log(table.toString());
  }

  async viewStats() {
    console.log(chalk.yellow('\nStats - use Web UI for detailed statistics.\n'));
  }

  async viewInjuries() {
    const userTeam = this.engine.getUserTeam();
    const players = this.engine.getPlayers({ tid: userTeam?.tid });
    const injured = players.filter(p => p.injury);

    if (injured.length === 0) {
      console.log(chalk.green('\nNo injured players!\n'));
      return;
    }

    console.log(chalk.cyan.bold('\n=== Injured Players ===\n'));

    const table = new Table({
      head: ['Name', 'Pos', 'Injury', 'Games Out'],
      colWidths: [20, 6, 20, 12]
    });

    for (const p of injured) {
      table.push([
        p.name,
        p.pos,
        p.injury?.type || 'Unknown',
        p.injury?.gamesRemaining?.toString() || '?'
      ]);
    }

    console.log(table.toString());
  }

  async offseasonMenu() {
    const state = this.engine.getState();

    if (!this.engine.isSeasonComplete()) {
      console.log(chalk.yellow('\nSeason is not complete. Finish all games first.\n'));
      return;
    }

    console.log(chalk.cyan.bold(`\n=== Offseason: Season ${state.season} → ${state.season + 1} ===\n`));

    const pending = this.engine.getPendingFreeAgents();
    console.log(`Pending free agents: ${pending.length}`);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Advance to next season?',
      default: true
    }]);

    if (!confirm) return;

    const spinner = ora('Processing offseason...').start();

    try {
      const result = await this.engine.advanceSeason();
      spinner.stop();

      if (result.success && result.result) {
        const r = result.result;
        console.log(chalk.green.bold('\n✅ Season advanced successfully!\n'));
        console.log(`Retired players: ${r.retiredPlayers.length}`);
        console.log(`New free agents: ${r.newFreeAgents.length}`);
        console.log(`Drafted players: ${r.draftedPlayers.length}`);
        console.log(`Hall of Fame inductees: ${r.hallOfFameInductees.length}`);
      } else {
        console.log(chalk.red(`\nError: ${result.error}\n`));
      }
    } catch (error) {
      spinner.fail('Error advancing season');
      console.error(error);
    }
  }

  async saveGameMenu() {
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'Save name:',
      default: `Save_${Date.now()}`
    }]);

    const spinner = ora('Saving game...').start();

    try {
      await this.engine.saveGame(name);
      spinner.succeed(`Game saved as "${name}"`);
    } catch (error) {
      spinner.fail('Failed to save game');
      console.error(error);
    }
  }
}

// Main entry point
async function main() {
  const game = new SIFINFLGame();
  await game.init();
}

main().catch(console.error);

export { SIFINFLGame };
