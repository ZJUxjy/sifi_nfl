import { useState, useMemo } from 'react';
import { Table, Form, InputGroup, Badge, Button } from 'react-bootstrap';
import type { Team, Player } from '@common/entities';
import type { Position } from '@common/types';

interface RosterViewProps {
  team: Team;
  players: Player[];
}

const POSITION_GROUPS: Record<string, Position[]> = {
  Offense: ['QB', 'RB', 'WR', 'TE', 'OL'],
  Defense: ['DL', 'LB', 'CB', 'S'],
  Special: ['K', 'P'],
};

function getOvrClass(ovr: number): string {
  if (ovr >= 85) return 'ovr-elite';
  if (ovr >= 75) return 'ovr-strong';
  if (ovr >= 60) return 'ovr-average';
  return 'ovr-weak';
}

function getPositionGroup(pos: Position): string {
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if (positions.includes(pos)) return group.toLowerCase();
  }
  return 'special';
}

function RosterView({ team, players }: RosterViewProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<keyof Player>('ovr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [positionFilter, setPositionFilter] = useState<Position | 'all'>('all');

  const filteredPlayers = useMemo(() => {
    let result = [...players];

    // Filter by position
    if (positionFilter !== 'all') {
      result = result.filter((p) => p.pos === positionFilter);
    }

    // Filter by search
    if (search) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortDir === 'desc' ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal);
    });

    return result;
  }, [players, search, sortBy, sortDir, positionFilter]);

  const handleSort = (field: keyof Player) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="roster-view">
      <div className="game-card p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 className="mb-0">Roster ({players.length} players)</h4>
          
          <div className="d-flex gap-3">
            <InputGroup style={{ width: 200 }}>
              <Form.Control
                placeholder="Search player..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>
            
            <Form.Select
              style={{ width: 120 }}
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as Position | 'all')}
            >
              <option value="all">All Pos</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="OL">OL</option>
              <option value="DL">DL</option>
              <option value="LB">LB</option>
              <option value="CB">CB</option>
              <option value="S">S</option>
              <option value="K">K</option>
              <option value="P">P</option>
            </Form.Select>
          </div>
        </div>

        <div className="player-table">
          <Table hover responsive>
            <thead>
              <tr>
                <th onClick={() => handleSort('pos')}>Pos</th>
                <th onClick={() => handleSort('name')}>Name</th>
                <th onClick={() => handleSort('age')}>Age</th>
                <th onClick={() => handleSort('ovr')}>OVR</th>
                <th onClick={() => handleSort('pot')}>POT</th>
                <th onClick={() => handleSort('contract')}>Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.pid}>
                  <td>
                    <span className={`pos-badge pos-${getPositionGroup(player.pos)}`}>
                      {player.pos}
                    </span>
                  </td>
                  <td>{player.name}</td>
                  <td>{player.age}</td>
                  <td>
                    <span className={getOvrClass(player.ovr)}>
                      <strong>{player.ovr}</strong>
                    </span>
                  </td>
                  <td>{player.pot}</td>
                  <td>
                    {player.contract 
                      ? `$${(player.contract.amount / 1000).toFixed(0)}K`
                      : 'FA'}
                  </td>
                  <td>
                    {player.injury ? (
                      <Badge bg="danger">Injured</Badge>
                    ) : (
                      <Badge bg="success">Healthy</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default RosterView;
