# YesMadam MySQL MCP Server

A Model Context Protocol (MCP) server that exposes YesMadam MySQL databases as tools for Claude Code and other MCP clients.

## Features

- Query YesMadam MySQL databases directly from Claude Code
- List all tables in the database
- Inspect table schemas
- Browse table data with pagination
- Get row counts and basic statistics
- Secure credential management via environment variables

## Prerequisites

- Node.js 18+
- VPN access to YesMadam (if connecting from external network)
- MySQL database credentials with appropriate permissions

## Setup Instructions

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure credentials

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your actual database credentials:

```
TABLEAU_DB_HOST=prodsqluseractivity.yesmadam.com
TABLEAU_DB_PORT=3306
TABLEAU_DB_USER=nidhish
TABLEAU_DB_PASSWORD=your_actual_password
TABLEAU_DB_NAME=ysmdm_admin
```

**⚠️ IMPORTANT:** `.env` is gitignored and should NEVER be committed. Keep credentials secure.

### 3. Verify connection (optional)

```bash
npm start
```

If successful, you'll see: `✓ Connected to ysmdm_admin at prodsqluseractivity.yesmadam.com`

Press `Ctrl+C` to exit.

## Configure Claude Code to use this MCP server

Edit your Claude Code settings to load this MCP server:

### Option A: Via Claude Code config file

Create or edit `.claude/settings.json`:

```json
{
  "mcpServers": {
    "yesmadam-mysql": {
      "type": "local",
      "command": "node",
      "args": ["/path/to/portfolio/mcp-server/src/index.js"],
      "env": {
        "TABLEAU_DB_HOST": "prodsqluseractivity.yesmadam.com",
        "TABLEAU_DB_PORT": "3306",
        "TABLEAU_DB_USER": "nidhish",
        "TABLEAU_DB_PASSWORD": "your_password_from_.env"
      }
    }
  }
}
```

### Option B: Via environment file

Alternatively, create a `.env.production` in the mcp-server directory and Claude Code will load it automatically.

## Available Tools

### query_database
Execute any custom SQL query:

```
Tool: query_database
Input: {"sql": "SELECT * FROM customers LIMIT 10"}
```

### list_tables
List all available tables:

```
Tool: list_tables
Input: {}
```

### get_table_schema
View column details for a table:

```
Tool: get_table_schema
Input: {"table_name": "customers"}
```

### get_table_data
Get sample data from a table:

```
Tool: get_table_data
Input: {"table_name": "customers", "limit": 20, "offset": 0}
```

### get_data_summary
Get row count for a table:

```
Tool: get_data_summary
Input: {"table_name": "customers"}
```

## Troubleshooting

### "Missing database credentials in .env file"
Make sure you have a `.env` file with all required fields from `.env.example`.

### "Database connection failed"
- Check VPN connection (if needed)
- Verify credentials are correct
- Confirm host/port is reachable
- Check MySQL user has appropriate permissions

### Claude Code doesn't see the tools
- Restart Claude Code completely
- Verify MCP server is running: `npm start`
- Check that the path in settings.json is correct

## Security Notes

- Never commit `.env` file to git (it's in `.gitignore`)
- Never paste credentials in messages or logs
- Rotate credentials periodically
- Use read-only database users when possible
- Log all queries for audit purposes (future enhancement)

## Development

### Run in watch mode

```bash
npm run dev
```

### View logs

```
npm start 2>&1 | tee server.log
```

## Future Enhancements

- [ ] Query history and audit logging
- [ ] Row-level access control
- [ ] Prepared statements for sensitive data
- [ ] Caching layer for frequent queries
- [ ] Export results to CSV/JSON
