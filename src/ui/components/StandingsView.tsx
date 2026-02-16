import { useMemo } from 'react';
import { Table, Badge } from 'react-bootstrap';
import { useGameStore } from '../stores/gameStore';
import { getGameEngine } from '../../worker/api';
import type { Team } from '@common/entities';
import type { StandingEntry } from '../../worker/api/types';

interface StandingsViewProps {
  team: Team;
}

function StandingsView({ team }: StandingsViewProps) {
  const { teams } = useGameStore();
  const engine = getGameEngine();

  // Get standings from GameEngine
  const standings = useMemo(() => {
    return engine.getStandings(team.region);
  }, [team.region, teams.length]);

  // Group by league if origin continent or mining island
  const groupedStandings = useMemo(() => {
    const isMultiLeague = team.region === 'originContinent' || team.region === 'miningIsland';

    if (!isMultiLeague) {
      return { '': standings };
    }

    const groups: Record<string, StandingEntry[]> = {};
    for (const standing of standings) {
      const teamData = teams.find(t => t.tid === standing.tid);
      const league = teamData?.cid ? `League ${teamData.cid}` : 'Other';
      if (!groups[league]) {
        groups[league] = [];
      }
      groups[league].push(standing);
    }

    return groups;
  }, [standings, teams, team.region]);

  const getRegionName = (region: string): string => {
    const names: Record<string, string> = {
      'firstContinent': 'First Continent',
      'secondContinent': 'Second Continent',
      'originContinent': 'Origin Continent',
      'miningIsland': 'Mining Island',
    };
    return names[region] || region;
  };

  const renderStandingRow = (standing: StandingEntry, index: number) => {
    const teamData = teams.find(t => t.tid === standing.tid);
    if (!teamData) return null;

    const pointDiff = standing.pts - standing.oppPts;

    return (
      <tr
        key={standing.tid}
        className={standing.tid === team.tid ? 'table-primary' : ''}
      >
        <td>
          {index < (team.region === 'originContinent' ? 2 : team.region === 'miningIsland' ? 1 : 4) ? (
            <Badge bg="success">{index + 1}</Badge>
          ) : (
            index + 1
          )}
        </td>
        <td>
          <strong>{teamData.name}</strong>
          {standing.tid === team.tid && (
            <Badge bg="info" className="ms-2">You</Badge>
          )}
        </td>
        <td>{standing.won}</td>
        <td>{standing.lost}</td>
        <td>{(standing.winPct * 100).toFixed(1)}%</td>
        <td>{standing.pts}</td>
        <td>{standing.oppPts}</td>
        <td style={{
          color: pointDiff > 0 ? '#22c55e' : pointDiff < 0 ? '#ef4444' : 'inherit'
        }}>
          {pointDiff > 0 ? '+' : ''}{pointDiff}
        </td>
      </tr>
    );
  };

  return (
    <div className="standings-view">
      <div className="game-card p-4">
        <h4 className="mb-4">
          Standings - {getRegionName(team.region)}
        </h4>

        {Object.entries(groupedStandings).map(([league, leagueStandings]) => (
          <div key={league} className="mb-4">
            {league && (
              <h5 className="mb-3">
                <Badge bg="secondary">{league}</Badge>
              </h5>
            )}

            <Table hover responsive>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Pct</th>
                  <th>PF</th>
                  <th>PA</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {leagueStandings
                  .sort((a, b) => {
                    if (a.won !== b.won) return b.won - a.won;
                    if (a.lost !== b.lost) return a.lost - b.lost;
                    return b.pts - a.pts;
                  })
                  .map((standing, index) => renderStandingRow(standing, index))}
              </tbody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StandingsView;
