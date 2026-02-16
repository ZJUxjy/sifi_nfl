import { useMemo } from 'react';
import { Row, Col, Card, ProgressBar } from 'react-bootstrap';
import type { Team, Player } from '@common/entities';

interface FinancesViewProps {
  team: Team;
  players: Player[];
}

function FinancesView({ team, players }: FinancesViewProps) {
  const finances = useMemo(() => {
    const payroll = players
      .filter((p) => p.contract)
      .reduce((sum, p) => sum + (p.contract?.amount ?? 0), 0);
    
    const salaryCap = 200000; // $200M
    const minimumPayroll = 150000; // $150M
    const luxuryTaxThreshold = 180000; // $180M
    
    // Estimated revenues
    const ticketRevenue = Math.round(team.pop === 'huge' ? 80000 : 
                                    team.pop === 'large' ? 60000 :
                                    team.pop === 'medium' ? 40000 : 25000);
    const tvRevenue = 50000;
    const merchandise = Math.round(team.pop === 'huge' ? 30000 : 
                                  team.pop === 'large' ? 20000 :
                                  team.pop === 'medium' ? 15000 : 10000);
    const sponsorships = Math.round(team.pop === 'huge' ? 40000 : 
                                   team.pop === 'large' ? 30000 :
                                   team.pop === 'medium' ? 20000 : 15000);
    
    const totalRevenue = ticketRevenue + tvRevenue + merchandise + sponsorships;
    const expenses = payroll + 20000; // +20K operating costs
    const profit = totalRevenue - expenses;
    
    const luxuryTax = payroll > luxuryTaxThreshold 
      ? Math.round((payroll - luxuryTaxThreshold) * 0.5) 
      : 0;
    
    return {
      payroll,
      salaryCap,
      minimumPayroll,
      luxuryTaxThreshold,
      capSpace: salaryCap - payroll,
      ticketRevenue,
      tvRevenue,
      merchandise,
      sponsorships,
      totalRevenue,
      expenses,
      profit,
      luxuryTax,
    };
  }, [team, players]);

  const formatMoney = (amount: number) => {
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  const capPercentage = Math.min((finances.payroll / finances.salaryCap) * 100, 100);

  return (
    <div className="finances-view">
      <Row>
        {/* Budget Overview */}
        <Col md={6} className="mb-4">
          <div className="game-card p-4 h-100">
            <h5 className="mb-4">💰 Budget Overview</h5>
            
            <div className="mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span>Salary Cap</span>
                <strong>{formatMoney(finances.salaryCap)}</strong>
              </div>
              <ProgressBar 
                now={capPercentage} 
                variant={capPercentage > 90 ? 'danger' : capPercentage > 75 ? 'warning' : 'success'}
              />
              <div className="d-flex justify-content-between mt-2 small text-muted">
                <span>Payroll: {formatMoney(finances.payroll)}</span>
                <span>Cap Space: {formatMoney(finances.capSpace)}</span>
              </div>
            </div>

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

            {finances.luxuryTax > 0 && (
              <div className="alert alert-warning mt-3 mb-0">
                ⚠️ Luxury Tax: {formatMoney(finances.luxuryTax)}
              </div>
            )}
          </div>
        </Col>

        {/* Revenue */}
        <Col md={6} className="mb-4">
          <div className="game-card p-4 h-100">
            <h5 className="mb-4">📈 Revenue</h5>
            
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
              <hr />
              <div className="d-flex justify-content-between">
                <strong>Total Revenue</strong>
                <strong style={{ color: '#22c55e' }}>{formatMoney(finances.totalRevenue)}</strong>
              </div>
            </div>
          </div>
        </Col>

        {/* Profit/Loss */}
        <Col md={12}>
          <div className="game-card p-4">
            <Row className="text-center">
              <Col md={4}>
                <div style={{ color: '#22c55e', fontSize: '2rem', fontWeight: 'bold' }}>
                  {formatMoney(finances.totalRevenue)}
                </div>
                <small className="text-muted">Total Revenue</small>
              </Col>
              <Col md={4}>
                <div style={{ color: '#ef4444', fontSize: '2rem', fontWeight: 'bold' }}>
                  -{formatMoney(finances.expenses)}
                </div>
                <small className="text-muted">Total Expenses</small>
              </Col>
              <Col md={4}>
                <div style={{ 
                  color: finances.profit >= 0 ? '#22c55e' : '#ef4444', 
                  fontSize: '2rem', 
                  fontWeight: 'bold' 
                }}>
                  {finances.profit >= 0 ? '+' : ''}{formatMoney(finances.profit)}
                </div>
                <small className="text-muted">Net Profit/Loss</small>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>
    </div>
  );
}

export default FinancesView;
