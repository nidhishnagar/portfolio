import React, { useState, useEffect } from 'react';

export default function QueryBuilder({ onSubmit, apiUrl }) {
  const [sql, setSql] = useState('SELECT * FROM tbl_order LIMIT 10');
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [schema, setSchema] = useState([]);

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/tables`);
      const data = await response.json();
      setTables(data.data || []);
    } catch (err) {
      console.error('Failed to fetch tables:', err);
    }
  };

  const fetchSchema = async (table) => {
    try {
      const response = await fetch(`${apiUrl}/api/schema/${table}`);
      const data = await response.json();
      setSchema(data.data || []);
    } catch (err) {
      console.error('Failed to fetch schema:', err);
    }
  };

  const handleTableSelect = (e) => {
    const table = e.target.value;
    setSelectedTable(table);
    if (table) fetchSchema(table);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(sql);
  };

  const insertColumn = (col) => {
    setSql((prev) => prev + ', ' + col);
  };

  return (
    <div className="query-builder">
      <div className="query-builder-layout">
        <div className="sidebar">
          <h3>Tables</h3>
          <select value={selectedTable} onChange={handleTableSelect}>
            <option value="">Select table...</option>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          {schema.length > 0 && (
            <div className="schema-panel">
              <h4>Columns</h4>
              {schema.map((col) => (
                <button
                  key={col.name}
                  className="column-btn"
                  onClick={() => insertColumn(col.name)}
                >
                  {col.name} <small>({col.type})</small>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="editor-panel">
          <form onSubmit={handleSubmit}>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="Write your SQL query here..."
              className="sql-editor"
            />
            <button type="submit" className="run-btn">
              Run Query
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
