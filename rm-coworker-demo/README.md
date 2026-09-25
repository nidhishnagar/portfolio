# RM Coworker Follow-Up Agent — Prototype

A working demonstration of how OneByZero's RM Coworker can be extended with an AI-powered Follow-Up Agent to close the post-call workflow gap.

## Problem

Relationship managers spend time on call prep (handled by RM Coworker today), but the follow-through remains manual:
- **Email drafts** to clients — takes 10-15 mins per call
- **CRM notes** to log the call outcome
- **Cross-sell flags** are inconsistent or missed entirely
- **Compliance routing** happens ad-hoc, slowing things down

At 120–180 accounts per RM, and <20% getting consistent proactive follow-up, this is where revenue quietly leaks.

## Solution

This agent reuses RM Coworker's existing enterprise access and framework (Knowledge/Channels/Skills/Tools) to:
1. Look up the client's profile, call transcript, and compliance requirements
2. Draft a contextual follow-up email
3. Suggest the next best CRM action
4. Flag cross-sell opportunities
5. Route for human review when needed (credit-sensitive, regulatory topics)

## Running the Demo

### Prerequisites
- Node.js 16+
- A valid Gemini API key (set in `.env`)

### Setup

```bash
npm install
```

### Environment

Create a `.env` file with:
```
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

### Start the Server

```bash
npm start
# or
node server.js
```

The demo runs on `http://localhost:3000` by default. Set `PORT` to override:
```bash
PORT=3001 npm start
```

### Testing the API

The `/api/run` endpoint accepts a scenario:

```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"scenario":"priya"}'
```

Available scenarios:
- `priya` — Premium client, education savings inquiry
- `rajesh` — SME with business expansion needs
- `quiet` — Corporate client with declining engagement

### What Happens

1. **Client lookup** — The agent calls `get_client_profile` to fetch CRM data
2. **Call summary** — If a call is logged, it retrieves the transcript summary via `get_call_transcript_summary`
3. **Compliance check** — It calls `check_compliance_flag` to see if the topic requires human sign-off
4. **Output** — The agent returns a structured JSON response:
   ```json
   {
     "email": "Draft follow-up email",
     "crm": "Suggested CRM action",
     "crosssell": "[RELEVANT/POSSIBLE/NOT APPLICABLE] Opportunity",
     "routing": "[AUTO/HUMAN REVIEW] Assessment"
   }
   ```

## Architecture

The prototype follows OBZ's standard AI Coworker architecture:

- **Knowledge** — Client profile, call history, product catalog, compliance rules (reused from RM Coworker)
- **Channels** — HTTP API (extensible to Slack, Teams, etc.)
- **Skills** — Function calling logic to look up and synthesize data
- **Tools** — Three mock tools that stand in for the real bank systems:
  - `get_client_profile` → CRM lookups
  - `get_call_transcript_summary` → Call log system
  - `check_compliance_flag` → Compliance/regulatory database

This is a **configuration, not a new build** — the agent inherits RM Coworker's existing enterprise access and security posture.

## Business Model

### Unit Economics
- **Per-RM cost savings**: ~2.5 hours/week of follow-up work (18–20 calls × 10 mins cleanup)
- **Deployed to**: 1 bank, 50 RMs initially
- **Use case pricing**: ₹50K–100K/month
- **Payback period**: <6 weeks
- **LTV (24-month horizon)**: ₹7.2L per RM cohort vs. ₹1.5L CAC

### Go-to-Market
1. **Pilot** — 5–10 RMs in the target bank (2–4 weeks)
2. **Measure** — Email quality scores, CRM compliance, follow-up velocity
3. **Expand** — Roll out to the wider RM team if pilot shows >15% time savings
4. **Extend** — Introduce new agents (prep, outreach, post-close) to expand ARR

## What This Proves

✅ **Scoped problem** — Closed a specific workflow gap  
✅ **Reuses existing infrastructure** — Leverages RM Coworker's access and architecture  
✅ **Real function calling** — Agent genuinely looks up data via tools  
✅ **Business case grounded** — Unit economics tie to actual RM workflows  
✅ **Ready to demo** — Works end-to-end with a live LLM  

---

Built for OneByZero. Questions? Contact the author.
