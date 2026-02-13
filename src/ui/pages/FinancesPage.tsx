import React, { useMemo } from 'react';
import { useGameStore } from '../store/gameStore';

const formatMoney = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
};

const FinancesPage: React.FC = () => {
  const { userTeam, players, userTid } = useGameStore();

  const payroll = useMemo(() => {
    return players
      .filter(p => p.tid === userTid)
      .reduce((sum, p) => sum + (p.contract?.amount || 0), 0);
  }, [players, userTid]);

  const salaryCap = 200000000; // $200M
  const capSpace = salaryCap - payroll;
  const luxuryTax = capSpace < 0 ? Math.abs(capSpace) * 0.5 : 0;

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">💰 Team Finances</h3>
        </div>

        {/* Overview Stats */}
        <div className="stat-grid">
          <div className="stat-box">
            <div className="stat-value">${userTeam?.budget}M</div>
            <div className="stat-label">Budget</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">${userTeam?.cash}M</div>
            <div className="stat-label">Cash</div>
          </div>
          <div className="stat-box">
            <div className="stat-value">{formatMoney(payroll)}</div>
            <div className="stat-label">Payroll</div>
          </div>
          <div className="stat-box">
            <div className="stat-value" style={{ color: capSpace >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {formatMoney(capSpace)}
            </div>
            <div className="stat-label">Cap Space</div>
          </div>
        </div>

        {/* Salary Cap Bar */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span>Salary Cap: {formatMoney(salaryCap)}</span>
            <span>{((payroll / salaryCap) * 100).toFixed(1)}%</span>
          </div>
          <div style={{ 
            background: 'var(--bg-hover)', 
            borderRadius: '4px', 
            height: '24px',
            position: 'relative'
          }}>
            <div style={{
              background: payroll > salaryCap 
                ? 'var(--danger)' 
                : 'linear-gradient(135deg, var(--primary), var(--secondary))',
              borderRadius: '4px',
              height: '100%',
              width: `${Math.min(100, (payroll / salaryCap) * 100)}%`,
              transition: 'width 0.3s'
            }} />
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '2px',
              background: 'var(--warning)'
            }} />
          </div>
          {luxuryTax > 0 && (
            <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
              ⚠️ Luxury Tax: {formatMoney(luxuryTax)}
            </p>
          )}
        </div>
      </div>

      {/* Revenue & Expenses */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📊 Revenue & Expenses</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h4 style={{ marginBottom: '1rem', color: 'var(--success)' }}>Revenue</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Ticket Sales', value: 25000000 },
                { label: 'Merchandise', value: 15000000 },
                { label: 'TV Rights', value: 40000000 },
                { label: 'Sponsorships', value: 20000000 },
                { label: 'Prize Money', value: 5000000 }
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span>{formatMoney(item.value)}</span>
                </div>
              ))}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 600,
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border)'
              }}>
                <span>Total</span>
                <span style={{ color: 'var(--success)' }}>{formatMoney(105000000)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>Expenses</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[
                { label: 'Player Salaries', value: payroll },
                { label: 'Signing Bonuses', value: 5000000 },
                { label: 'Coaching Staff', value: 10000000 },
                { label: 'Facilities', value: 8000000 },
                { label: 'Travel', value: 3000000 }
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span>{formatMoney(item.value)}</span>
                </div>
              ))}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontWeight: 600,
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--border)'
              }}>
                <span>Total</span>
                <span style={{ color: 'var(--danger)' }}>{formatMoney(payroll + 26000000)}</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          background: 'var(--bg-hover)', 
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Net Profit: </span>
          <span style={{ 
            fontSize: '1.5rem', 
            fontWeight: 700,
            color: 'var(--success)'
          }}>
            {formatMoney(105000000 - payroll - 26000000)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FinancesPage;
