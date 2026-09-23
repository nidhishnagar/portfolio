import React, { useState, useEffect } from 'react';

export default function Analytics({ apiUrl }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/metrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading metrics...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!metrics) return null;

  return (
    <div className="analytics">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Orders (Last 7 Days)</h3>
          <div className="metric-value">
            {metrics.ordersLast7Days?.total || 0}
          </div>
        </div>
      </div>

      {metrics.topCategories && metrics.topCategories.length > 0 && (
        <div className="top-categories">
          <h3>Top Categories This Month</h3>
          <div className="category-list">
            {metrics.topCategories.map((cat, i) => (
              <div key={i} className="category-item">
                <span className="rank">#{i + 1}</span>
                <span className="name">{cat.category}</span>
                <span className="count">{cat.count} orders</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={fetchMetrics} className="refresh-btn">
        Refresh Metrics
      </button>
    </div>
  );
}
