# YesMadam Analytics Platform

Full-stack analytics dashboard with API backend, query builder, and data visualization.

## Architecture

```
Frontend (React)
  ├── Dashboard (key metrics)
  ├── Query Builder (SQL editor + schema explorer)
  └── Results Table

Backend (Express.js)
  ├── /api/query - Execute SQL queries
  ├── /api/tables - List available tables
  ├── /api/schema/:table - Get table schema
  └── /api/metrics - Predefined analytics queries

ClickHouse Database
```

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with ClickHouse credentials
npm run dev  # or `npm start` for production
```

Backend runs on `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# (adjust REACT_APP_API_URL if backend is on different host)
npm start
```

Frontend runs on `http://localhost:3000`

## Features

### Dashboard
- Orders count (last 7 days)
- Top 10 categories by order count (this month)
- Auto-refresh metrics

### Query Builder
- SQL editor with syntax highlighting
- Browse available tables
- Click columns to insert into query
- View table schemas
- Run custom queries
- Results table display

### API Routes

**GET /health**
```json
{ "status": "ok" }
```

**POST /api/query**
```json
{
  "sql": "SELECT * FROM tbl_order LIMIT 10"
}
```

**GET /api/tables**
```json
{
  "data": [
    { "name": "tbl_order" },
    { "name": "tbl_customer" }
  ]
}
```

**GET /api/schema/:table**
```json
{
  "data": [
    { "name": "order_id", "type": "UInt64" },
    { "name": "order_date", "type": "Date" }
  ]
}
```

**GET /api/metrics**
```json
{
  "ordersLast7Days": { "total": 1234 },
  "topCategories": [
    { "category": "Hair", "count": 456 },
    { "category": "Spa", "count": 389 }
  ]
}
```

## Environment Variables

### Backend (.env)
- `CLICKHOUSE_HOST` - ClickHouse server hostname
- `CLICKHOUSE_PORT` - Port (default: 8443)
- `CLICKHOUSE_USER` - Username
- `CLICKHOUSE_PASSWORD` - Password
- `CLICKHOUSE_DATABASE` - Database name
- `CLICKHOUSE_SECURE` - Use TLS (true/false)
- `PORT` - API port (default: 3001)

### Frontend (.env)
- `REACT_APP_API_URL` - Backend API URL (default: http://localhost:3001)

## Development

**Backend changes?** Backend auto-reloads with nodemon.

**Frontend changes?** React dev server auto-reloads.

## Deployment

### Backend
```bash
npm install --production
npm start
```

### Frontend
```bash
npm run build
# Serve `build/` folder with your static host
```

## Extending

### Add a new metric
1. Add SQL query in `backend/src/server.js` → `/api/metrics`
2. Display in `frontend/src/components/Analytics.jsx`

### Add a new API endpoint
1. Define in `backend/src/server.js`
2. Call from frontend via `fetch(${API_URL}/api/...)`

### Customize styling
Edit `frontend/src/App.css`
