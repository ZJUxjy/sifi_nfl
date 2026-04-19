import { useMemo } from 'react';
import { Row, Col, Card, ProgressBar, Alert, Table, Badge } from 'react-bootstrap';
import { getGameEngine } from '../../worker/api';
import type { Team, Player } from '@common/entities';
import { REGION_LEAGUE_STRUCTURE } from '@common/constants.football';

interface FinancesViewProps {
  team: Team;
  players: Player[];
}

function FinancesView({ team, players }: FinancesViewProps) {
  const engine = getGameEngine();

  const finances = useMemo(() => {
    // Get persisted finances from GameEngine
    const engineFinances = engine.getTeamFinances(team.tid);

    const payroll = players
      .filter((p) => p.contract)
      .reduce((sum, p) => sum + (p.contract?.amount ?? 0), 0);

    // Get region-specific economic config
    const regionConfig = REGION_LEAGUE_STRUCTURE[team.region as keyof typeof REGION_LEAGUE_STRUCTURE];
    const salaryCap = (regionConfig as any)?.salaryCap ?? null;
    const minimumPayroll = (regionConfig as any)?.minPayroll ?? null;
    const luxuryTaxThreshold = (regionConfig as any)?.luxuryPayroll ?? null;
    const hasSalaryCap = salaryCap !== null;

    // Estimated annual revenues (in dollars)
    // Use team.pop (string) or team.market (MarketSize enum)
    const popValue = team.pop || team.market || 'medium';
    const marketMultiplier = popValue === 'huge' || popValue === 'Huge' ? 1.5 :
                            popValue === 'large' || popValue === 'Large' ? 1.2 :
                            popValue === 'medium' || popValue === 'Medium' ? 1.0 : 0.7;

    const baseTicketRevenue = 40000000; // $40M base
    const baseTvRevenue = 60000000;     // $60M base
    const baseMerchandise = 15000000;   // $15M base
    const baseSponsorships = 25000000;  // $25M base

    const ticketRevenue = engineFinances.revenue.ticketSales || Math.round(baseTicketRevenue * marketMultiplier);
    const tvRevenue = engineFinances.revenue.tvRights || Math.round(baseTvRevenue * marketMultiplier);
    const merchandise = engineFinances.revenue.merchandise || Math.round(baseMerchandise * marketMultiplier);
    const sponsorships = engineFinances.revenue.sponsorships || Math.round(baseSponsorships * marketMultiplier);
    const prizeMoney = engineFinances.revenue.prizeMoney || 0;

    const totalRevenue = ticketRevenue + tvRevenue + merchandise + sponsorships + prizeMoney;
    const operatingCosts = 15000000; // $15M operating costs
    const coachingCosts = engineFinances.expenses.coaching || 5000000;
    const facilitiesCosts = engineFinances.expenses.facilities || 3000000;
    const travelCosts = engineFinances.expenses.travel || 2000000;
    const signingBonuses = engineFinances.expenses.signingBonuses || 0;

    const expenses = payroll + operatingCosts + coachingCosts + facilitiesCosts + travelCosts + signingBonuses;
    const profit = totalRevenue - expenses;

    // Luxury tax (only for regions with salary cap)
    const luxuryTax = hasSalaryCap && luxuryTaxThreshold && payroll > luxuryTaxThreshold
      ? Math.round((payroll - luxuryTaxThreshold) * 0.5)
      : 0;

    // Cap space (only for regions with salary cap)
    const capSpace = hasSalaryCap && salaryCap ? salaryCap - payroll : null;

    return {
      payroll,
      salaryCap,
      minimumPayroll,
      luxuryTaxThreshold,
      capSpace,
      hasSalaryCap,
      ticketRevenue,
      tvRevenue,
      merchandise,
      sponsorships,
      prizeMoney,
      totalRevenue,
      expenses,
      profit,
      luxuryTax,
      coachingCosts,
      facilitiesCosts,
      travelCosts,
      signingBonuses,
      operatingCosts,
    };
  }, [team, players, engine]);

  const formatMoney = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  const capPercentage = finances.hasSalaryCap && finances.salaryCap
    ? Math.min((finances.payroll / finances.salaryCap) * 100, 100)
    : 0;

  return (
    <div className="finances-view">
      <Row>
        {/* Budget Overview */}
        <Col md={6} className="mb-4">
          <div className="game-card p-4 h-100">
            <h5 className="mb-4">💰 Budget Overview</h5>

            {finances.hasSalaryCap ? (
              <>
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-2">
                    <span>Salary Cap</span>
                    <strong>{formatMoney(finances.salaryCap!)}</strong>
                  </div>
                  <ProgressBar
                    now={capPercentage}
                    variant={capPercentage > 95 ? 'danger' : capPercentage > 80 ? 'warning' : 'success'}
                  />
                  <div className="d-flex justify-content-between mt-2 small text-muted">
                    <span>Payroll: {formatMoney(finances.payroll)}</span>
                    <span>Cap Space: {formatMoney(finances.capSpace!)}</span>
                  </div>
                </div>

                {finances.minimumPayroll && finances.payroll < finances.minimumPayroll && (
                  <Alert variant="warning" className="mb-3">
                    ⚠️ Payroll below floor ({formatMoney(finances.minimumPayroll)})
                  </Alert>
                )}

                {finances.luxuryTax > 0 && (
                  <Alert variant="danger" className="mb-3">
                    💸 Luxury Tax: {formatMoney(finances.luxuryTax)}
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="info" className="mb-3">
                <strong>No Salary Cap</strong><br />
                {team.region === 'originContinent'
                  ? '起源大陆没有工资帽限制，球队自负盈亏。'
                  : 'This region has no salary cap restrictions.'}
              </Alert>
            )}

            <Row className="text-center">
              <Col xs={6} className="mb-3">
                <div className="stat-value">{formatMoney(team.budget)}</div>
                <small className="text-muted">Total Budget</small>
              </Col>
              <Col xs={6} className="mb-3">
                <div className="stat-value">{formatMoney(team.cash)}</div>
                <small className="text-muted">Cash</small>
              </Col>
            </Row>

            <div className="text-center mt-3">
              <div className="stat-value">{formatMoney(finances.payroll)}</div>
              <small className="text-muted">Current Payroll</small>
            </div>
          </div>
        </Col>

        {/* Revenue */}
        <Col md={6} className="mb-4">
          <div className="game-card p-4 h-100">
            <h5 className="mb-4">📈 Annual Revenue</h5>

            <div className="mb-3">
              <div className="d-flex justify-content-between mb-1">
                <span>🎫 Tickets</span>
                <span>{formatMoney(finances.ticketRevenue)}</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>📺 TV Rights</span>
                <span>{formatMoney(finances.tvRevenue)}</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>👕 Merchandise</span>
                <span>{formatMoney(finances.merchandise)}</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>🤝 Sponsorships</span>
                <span>{formatMoney(finances.sponsorships)}</span>
              </div>
              {finances.prizeMoney > 0 && (
                <div className="d-flex justify-content-between mb-1">
                  <span>🏆 Prize Money</span>
                  <span className="text-success">{formatMoney(finances.prizeMoney)}</span>
                </div>
              )}
              <hr />
              <div className="d-flex justify-content-between">
                <strong>Total Revenue</strong>
                <strong style={{ color: '#22c55e' }}>{formatMoney(finances.totalRevenue)}</strong>
              </div>
            </div>
          </div>
        </Col>

        {/* Expenses Breakdown */}
        <Col md={6} className="mb-4">
          <div className="game-card p-4 h-100">
            <h5 className="mb-4">💸 Expenses Breakdown</h5>

            <Table size="sm" borderless>
              <tbody>
                <tr>
                  <td>💼 Player Salaries</td>
                  <td className="text-end">{formatMoney(finances.payroll)}</td>
                </tr>
                {finances.signingBonuses > 0 && (
                  <tr>
                    <td>✍️ Signing Bonuses</td>
                    <td className="text-end">{formatMoney(finances.signingBonuses)}</td>
                  </tr>
                )}
                <tr>
                  <td>👨‍🏫 Coaching Staff</td>
                  <td className="text-end">{formatMoney(finances.coachingCosts)}</td>
                </tr>
                <tr>
                  <td>🏟️ Facilities</td>
                  <td className="text-end">{formatMoney(finances.facilitiesCosts)}</td>
                </tr>
                <tr>
                  <td>✈️ Travel</td>
                  <td className="text-end">{formatMoney(finances.travelCosts)}</td>
                </tr>
                <tr>
                  <td>⚙️ Operating Costs</td>
                  <td className="text-end">{formatMoney(finances.operatingCosts)}</td>
                </tr>
                {finances.luxuryTax > 0 && (
                  <tr>
                    <td>💸 Luxury Tax</td>
                    <td className="text-end text-danger">{formatMoney(finances.luxuryTax)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-top">
                  <th>Total Expenses</th>
                  <th className="text-end text-danger">{formatMoney(finances.expenses + finances.luxuryTax)}</th>
                </tr>
              </tfoot>
            </Table>
          </div>
        </Col>

        {/* Profit/Loss */}
        <Col md={6} className="mb-4">
          <div className="game-card p-4 h-100">
            <h5 className="mb-4">📊 Financial Summary</h5>

            <Row className="text-center">
              <Col xs={4}>
                <div style={{ color: '#22c55e', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  {formatMoney(finances.totalRevenue)}
                </div>
                <small className="text-muted">Revenue</small>
              </Col>
              <Col xs={4}>
                <div style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 'bold' }}>
                  -{formatMoney(finances.expenses)}
                </div>
                <small className="text-muted">Expenses</small>
              </Col>
              <Col xs={4}>
                <div style={{
                  color: finances.profit >= 0 ? '#22c55e' : '#ef4444',
                  fontSize: '1.5rem',
                  fontWeight: 'bold'
                }}>
                  {finances.profit >= 0 ? '+' : ''}{formatMoney(finances.profit)}
                </div>
                <small className="text-muted">Net</small>
              </Col>
            </Row>

            <div className="mt-4">
              <ProgressBar className="mb-2">
                <ProgressBar
                  variant="success"
                  now={Math.min((finances.totalRevenue / Math.max(finances.totalRevenue, finances.expenses)) * 50, 50)}
                  key={1}
                />
                <ProgressBar
                  variant="danger"
                  now={Math.min((finances.expenses / Math.max(finances.totalRevenue, finances.expenses)) * 50, 50)}
                  key={2}
                />
              </ProgressBar>
              <div className="d-flex justify-content-between small text-muted">
                <span>Revenue</span>
                <span>Expenses</span>
              </div>
            </div>

            {finances.profit < 0 && (
              <Alert variant="warning" className="mt-3 mb-0 py-2">
                ⚠️ Team is operating at a loss this season
              </Alert>
            )}
          </div>
        </Col>
      </Row>

      {/* Region-specific Info */}
      {team.region === 'miningIsland' && (
        <Row>
          <Col md={12}>
            <Alert variant="info">
              <h6 className="mb-2">⛏️ Mining Island Economics</h6>
              <p className="mb-0 small">
                Mining Island teams operate with reduced budgets but can earn significant prize money
                through promotion. Teams receive bonuses for winning their tier championship.
              </p>
            </Alert>
          </Col>
        </Row>
      )}
    </div>
  );
}

export default FinancesView;
