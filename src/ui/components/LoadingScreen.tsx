import React from 'react';

const LoadingScreen: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'var(--bg-dark)'
    }}>
      <div className="spinner"></div>
      <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
        Generating universe...
      </p>
    </div>
  );
};

export default LoadingScreen;
