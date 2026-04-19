import { useMemo, useState } from 'react';
import { Table, Card, Tabs, Tab, Badge, Form, Row, Col } from 'react-bootstrap';
import { useSeason, useTeams, usePlayers } from '../stores/selectors';
import { getGameEngine } from '../../worker/api';
import type { PlayerSeasonStats } from '@common/stats';
import type { Position } from '@common/types';

type StatCategory = 'passing' | 'rushing' | 'receiving' | 'defense' | 'kicking' | 'returns';

interface StatColumn {
  key: string;
  label: string;
  format?: (val: number) => string;
}

const PASSING_COLUMNS: StatColumn[] = [
  { key: 'gp', label: 'GP' },
  { key: 'pass.att', label: 'ATT' },
  { key: 'pass.cmp', label: 'CMP' },
  { key: 'pass.yds', label: 'YDS' },
  { key: 'pass.td', label: 'TD' },
  { key: 'pass.int', label: 'INT' },
  { key: 'pass.rate', label: 'RTG', format: (v) => v.toFixed(1) },
];

const RUSHING_COLUMNS: StatColumn[] = [
  { key: 'gp', label: 'GP' },
  { key: 'rush.att', label: 'ATT' },
  { key: 'rush.yds', label: 'YDS' },
  { key: 'rush.ypc', label: 'AVG', format: (v) => v.toFixed(1) },
  { key: 'rush.td', label: 'TD' },
  { key: 'rush.lng', label: 'LNG' },
  { key: 'rush.fmb', label: 'FUM' },
];

const RECEIVING_COLUMNS: StatColumn[] = [
  { key: 'gp', label: 'GP' },
  { key: 'recv.tgt', label: 'TGT' },
  { key: 'recv.rec', label: 'REC' },
  { key: 'recv.yds', label: 'YDS' },
  { key: 'recv.ypr', label: 'AVG', format: (v) => v.toFixed(1) },
  { key: 'recv.td', label: 'TD' },
  { key: 'recv.lng', label: 'LNG' },
];

const DEFENSE_COLUMNS: StatColumn[] = [
  { key: 'gp', label: 'GP' },
  { key: 'def.tck', label: 'TCK' },
  { key: 'def.tckSolo', label: 'SOLO' },
  { key: 'def.sk', label: 'SK' },
  { key: 'def.int', label: 'INT' },
  { key: 'def.ff', label: 'FF' },
  { key: 'def.fr', label: 'FR' },
  { key: 'def.pd', label: 'PD' },
];

const KICKING_COLUMNS: StatColumn[] = [
  { key: 'gp', label: 'GP' },
  { key: 'kick.fgMade', label: 'FGM' },
  { key: 'kick.fgAtt', label: 'FGA' },
  { key: 'kick.fgLng', label: 'LNG' },
  { key: 'kick.xpMade', label: 'XPM' },
  { key: 'kick.xpAtt', label: 'XPA' },
  { key: 'kick.koTB', label: 'TB' },
];

const RETURN_COLUMNS: StatColumn[] = [
  { key: 'gp', label: 'GP' },
  { key: 'ret.kr', label: 'KR' },
  { key: 'ret.krYds', label: 'KR YDS' },
  { key: 'ret.krTD', label: 'KR TD' },
  { key: 'ret.pr', label: 'PR' },
  { key: 'ret.prYds', label: 'PR YDS' },
  { key: 'ret.prTD', label: 'PR TD' },
];

function getNestedValue(obj: any, path: string): number {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return 0;
    current = current[part];
  }
  return current ?? 0;
}

function StatsView() {
  const season = useSeason();
  const teams = useTeams();
  const players = usePlayers();
  const [category, setCategory] = useState<StatCategory>('passing');
  const [teamFilter, setTeamFilter] = useState<number | 'all'>('all');
  const [positionFilter, setPositionFilter] = useState<Position | 'all'>('all');

  const engine = getGameEngine();

  // Get all player stats
  const allStats = useMemo(() => {
    return engine.getAllPlayerStats(season).filter(s => !s.playoffs);
  }, [engine, season]);

  // Filter and sort stats based on category
  const displayStats = useMemo(() => {
    let filtered = [...allStats];

    // Apply team filter
    if (teamFilter !== 'all') {
      filtered = filtered.filter(s => s.tid === teamFilter);
    }

    // Get sort key based on category
    const sortKeys: Record<StatCategory, string> = {
      passing: 'pass.yds',
      rushing: 'rush.yds',
      receiving: 'recv.yds',
      defense: 'def.tck',
      kicking: 'kick.fgMade',
      returns: 'ret.krYds',
    };

    const sortKey = sortKeys[category];

    // Sort by primary stat descending
    filtered.sort((a, b) => {
      const aVal = getNestedValue(a, sortKey);
      const bVal = getNestedValue(b, sortKey);
      return bVal - aVal;
    });

    // Filter by position after sorting
    if (positionFilter !== 'all') {
      const positionPlayers = new Set(
        players.filter(p => p.pos === positionFilter).map(p => p.pid)
      );
      filtered = filtered.filter(s => positionPlayers.has(s.pid));
    }

    return filtered.slice(0, 50); // Top 50
  }, [allStats, category, teamFilter, positionFilter, players]);

  // Get columns for current category
  const columns = useMemo(() => {
    const columnMap: Record<StatCategory, StatColumn[]> = {
      passing: PASSING_COLUMNS,
      rushing: RUSHING_COLUMNS,
      receiving: RECEIVING_COLUMNS,
      defense: DEFENSE_COLUMNS,
      kicking: KICKING_COLUMNS,
      returns: RETURN_COLUMNS,
    };
    return columnMap[category];
  }, [category]);

  // Get player info
  const getPlayerInfo = (pid: number) => {
    const player = players.find(p => p.pid === pid);
    const team = teams.find(t => t.tid === player?.tid);
    return { player, team };
  };

  const formatValue = (stats: PlayerSeasonStats, col: StatColumn) => {
    const value = getNestedValue(stats, col.key);
    if (col.format) {
      return col.format(value);
    }
    return value.toString();
  };

  // Check if there are any stats
  const hasStats = allStats.length > 0 && allStats.some(s => s.gp > 0);

  if (!hasStats) {
    return (
      <div className="stats-view">
        <Card className="p-4">
          <div className="text-center text-muted">
            <h4>No Statistics Available</h4>
            <p>Statistics will be available after games are played.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="stats-view">
      <Card className="p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">League Statistics - Season {season}</h4>
        </div>

        {/* Filters */}
        <Row className="mb-3">
          <Col md={4}>
            <Form.Select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">All Teams</option>
              {teams.map(t => (
                <option key={t.tid} value={t.tid}>{t.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={4}>
            <Form.Select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as Position | 'all')}
            >
              <option value="all">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="DL">DL</option>
              <option value="LB">LB</option>
              <option value="CB">CB</option>
              <option value="S">S</option>
              <option value="K">K</option>
              <option value="P">P</option>
            </Form.Select>
          </Col>
        </Row>

        {/* Category Tabs */}
        <Tabs
          activeKey={category}
          onSelect={(k) => setCategory(k as StatCategory)}
          className="mb-3"
        >
          <Tab eventKey="passing" title="Passing" />
          <Tab eventKey="rushing" title="Rushing" />
          <Tab eventKey="receiving" title="Receiving" />
          <Tab eventKey="defense" title="Defense" />
          <Tab eventKey="kicking" title="Kicking" />
          <Tab eventKey="returns" title="Returns" />
        </Tabs>

        {/* Stats Table */}
        <Table striped hover responsive>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              {columns.map(col => (
                <th key={col.key} className="text-end">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayStats.map((stats, idx) => {
              const { player, team } = getPlayerInfo(stats.pid);
              if (!player) return null;

              return (
                <tr key={stats.pid}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{player.name}</strong>
                  </td>
                  <td>
                    <Badge bg="secondary">{player.pos}</Badge>
                  </td>
                  <td>{team?.abbrev || 'FA'}</td>
                  {columns.map(col => (
                    <td key={col.key} className="text-end">
                      {formatValue(stats, col)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </Table>

        {displayStats.length === 0 && (
          <div className="text-center text-muted py-4">
            No players match the current filters.
          </div>
        )}
      </Card>
    </div>
  );
}

export default StatsView;
