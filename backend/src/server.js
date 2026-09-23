require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@clickhouse/client');

const app = express();
app.use(cors());
app.use(express.json());

let client;

async function initClient() {
  client = createClient({
    host: process.env.CLICKHOUSE_HOST,
    port: process.env.CLICKHOUSE_PORT || 8443,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    database: process.env.CLICKHOUSE_DATABASE || 'default',
    ssl: process.env.CLICKHOUSE_SECURE === 'true',
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/query', async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL query required' });

    const result = await client.query({
      query: sql,
      format: 'JSON',
    });

    const data = await result.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const result = await client.query({
      query: 'SELECT name FROM system.tables WHERE database = currentDatabase()',
      format: 'JSON',
    });
    const data = await result.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/schema/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const result = await client.query({
      query: `DESCRIBE TABLE ${table}`,
      format: 'JSON',
    });
    const data = await result.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = {};

    const ordersResult = await client.query({
      query: `SELECT count(*) as total FROM tbl_order WHERE order_date >= today() - 7`,
      format: 'JSON',
    });
    metrics.ordersLast7Days = (await ordersResult.json()).data[0];

    const categoriesResult = await client.query({
      query: `SELECT category, count(*) as count FROM tbl_order
               WHERE toStartOfMonth(order_date) = toStartOfMonth(today())
               GROUP BY category ORDER BY count DESC LIMIT 10`,
      format: 'JSON',
    });
    metrics.topCategories = (await categoriesResult.json()).data;

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function start() {
  await initClient();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
