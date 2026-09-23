import React, { useState, useEffect } from 'react';
import './App.css';
import QueryBuilder from './components/QueryBuilder';
import Analytics from './components/Analytics';
import Results from './components/Results';

function App() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const handleQuerySubmit = async (sql) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>YesMadam Analytics</h1>
        <nav className="tabs">
          <button
            className={`tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Dashboard
          </button>
          <button
            className={`tab ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            Query Builder
          </button>
        </nav>
      </header>

      <main className="app-content">
        {activeTab === 'analytics' && <Analytics apiUrl={API_URL} />}
        {activeTab === 'builder' && (
          <div className="builder-section">
            <QueryBuilder onSubmit={handleQuerySubmit} apiUrl={API_URL} />
            {error && <div className="error">{error}</div>}
            {loading && <div className="loading">Loading...</div>}
            {results && <Results data={results} />}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
