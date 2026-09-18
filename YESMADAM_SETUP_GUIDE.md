# YesMadam MySQL MCP Server - Complete Setup Guide

Your MCP server has been created! Follow these steps to integrate it with Claude Code.

## 📋 Quick Overview

You now have:
- ✅ MCP Server code (handles MySQL connections)
- ✅ Secure credential template (.env.example)
- ✅ Claude Code configuration template
- ✅ Database tools for querying/exploring data

## 🚀 Setup Steps (Do This Now)

### Step 1: Set Up Your Local .env File

```bash
cd mcp-server
cp .env.example .env
```

Edit `mcp-server/.env` and add your actual credentials:

```env
TABLEAU_DB_HOST=prodsqluseractivity.yesmadam.com
TABLEAU_DB_PORT=3306
TABLEAU_DB_USER=nidhish
TABLEAU_DB_PASSWORD=NidhiYm2025#@
TABLEAU_DB_NAME=ysmdm_admin
```

**⚠️ DO NOT commit .env to git - it's already in .gitignore**

### Step 2: Install Dependencies

```bash
cd mcp-server
npm install
```

This installs:
- MySQL client
- MCP SDK
- dotenv for credential loading

### Step 3: Test the Connection

```bash
npm start
```

You should see:
```
✓ Connected to ysmdm_admin at prodsqluseractivity.yesmadam.com
YesMadam MySQL MCP Server is running
```

Press `Ctrl+C` to stop. ✅ If you see this, your database connection works!

### Step 4: Configure Claude Code to Use This MCP Server

**Option A: Web/Desktop Claude Code**

1. Open Claude Code settings (File → Settings or `Cmd+,`)
2. Go to **MCP Servers** section
3. Add new server:
   - **Name:** `yesmadam-mysql`
   - **Command:** `node`
   - **Arguments:** `/path/to/your/portfolio/mcp-server/src/index.js`
   - **Environment Variables:**
     ```
     TABLEAU_DB_HOST=prodsqluseractivity.yesmadam.com
     TABLEAU_DB_PORT=3306
     TABLEAU_DB_USER=nidhish
     TABLEAU_DB_PASSWORD=NidhiYm2025#@
     TABLEAU_DB_NAME=ysmdm_admin
     ```
4. Save and restart Claude Code

**Option B: Via settings.json**

Edit `~/.claude/settings.json` (or create it):

```json
{
  "mcpServers": {
    "yesmadam-mysql": {
      "type": "local",
      "command": "node",
      "args": [
        "/home/user/portfolio/mcp-server/src/index.js"
      ],
      "env": {
        "TABLEAU_DB_HOST": "prodsqluseractivity.yesmadam.com",
        "TABLEAU_DB_PORT": "3306",
        "TABLEAU_DB_USER": "nidhish",
        "TABLEAU_DB_PASSWORD": "NidhiYm2025#@",
        "TABLEAU_DB_NAME": "ysmdm_admin"
      }
    }
  }
}
```

### Step 5: Restart Claude Code

Fully close and reopen Claude Code. The MCP server should now be available as tools.

## 🎯 Available Tools in Claude Code

Once connected, ask Claude in your Claude Code session things like:

**List all tables:**
```
@Claude Can you list all the tables in the YesMadam database?
```

**Explore a table:**
```
@Claude What columns are in the 'customers' table?
```

**Get data:**
```
@Claude Show me the first 20 rows from the 'orders' table
```

**Custom queries:**
```
@Claude Run this query: SELECT COUNT(*) as total_customers FROM customers WHERE created_at > '2024-01-01'
```

Claude will automatically use the MCP tools to fetch data from your database.

## 🔒 Security Checklist

- [ ] .env file created with actual credentials
- [ ] .env is in .gitignore (verify with `git status`)
- [ ] Never share .env file
- [ ] Never paste credentials in chat
- [ ] Only share mcp-server/ code, not .env
- [ ] .env.example only has template values (no secrets)

## 🐛 Troubleshooting

### "Cannot find module '@modelcontextprotocol/sdk'"
Run `npm install` again in the mcp-server directory

### "Database connection failed"
1. Verify .env file has correct credentials
2. Check VPN connection (if needed)
3. Test with `npm start` - does it show the connection message?
4. Try telnet: `telnet prodsqluseractivity.yesmadam.com 3306`

### Claude Code doesn't show the tools
1. Fully restart Claude Code (close completely, reopen)
2. Check that MCP server is running: `npm start` in another terminal
3. Verify path in settings is correct (use absolute path)
4. Check Claude Code logs for errors

### "Connection timeout"
- You might need VPN. Are you connected to YesMadam VPN?
- Test: `ping prodsqluseractivity.yesmadam.com`

## 📊 Example Queries to Try

Once connected, here are some things you can ask Claude:

1. **Data exploration:**
   - "List all tables in the database"
   - "Show me the schema for the customers table"
   - "Get me 10 sample rows from the orders table"

2. **Analytics:**
   - "Count how many active customers we have"
   - "Show me customer acquisition trends by month"
   - "Get the top 10 customers by revenue"

3. **Laser & Toning specific:**
   - "What's the conversion rate for laser segment?"
   - "Show feeder matrix for toning services"
   - "Get category cross-sell analysis"

## 🔄 VPN Setup (if connecting from outside YesMadam office)

If you're outside the office, you may need VPN:

1. **Connect to OpenVPN:**
   ```bash
   sudo openvpn --config your-config.ovpn
   ```
   Or use your VPN client GUI

2. **Update .env:**
   ```env
   VPN_ENABLED=true
   VPN_URL=https://secure.yesmadam.com/
   ```

3. Test with `npm start`

## 📝 Next Steps

1. ✅ Set up .env with your credentials
2. ✅ Install dependencies (`npm install`)
3. ✅ Test connection (`npm start`)
4. ✅ Configure Claude Code
5. ✅ Restart Claude Code
6. 🎉 Start querying your data!

## 💡 Tips

- Keep the MCP server running in a terminal while using Claude Code
- Use `npm run dev` for live reloading during development
- All queries are executed in real-time - be careful with large datasets
- Consider adding `LIMIT` to queries to avoid timeouts
- Log all your analyses for audit purposes

## 📞 Support

If you run into issues:
1. Check the MCP server logs: `npm start`
2. Verify .env credentials
3. Test MySQL connection directly: `mysql -h prodsqluseractivity.yesmadam.com -u nidhish -p`
4. Check that you're on the YesMadam VPN (if needed)

---

**You're all set!** Start asking Claude Code questions about your YesMadam data. 🚀
