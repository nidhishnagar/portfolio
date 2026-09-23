import React from 'react';

export default function Results({ data }) {
  if (!data || !data.data || data.data.length === 0) {
    return <div className="results-empty">No results</div>;
  }

  const columns = Object.keys(data.data[0]);

  return (
    <div className="results">
      <h3>Query Results ({data.data.length} rows)</h3>
      <div className="results-table-wrapper">
        <table className="results-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => (
                  <td key={`${idx}-${col}`}>{String(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
