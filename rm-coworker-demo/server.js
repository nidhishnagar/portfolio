require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// If the primary model is overloaded ("high demand") or deprecated, we fall
// back through this list in order instead of just failing the request.
// 'gemini-flash-latest' is Google's own rolling alias — it always points at
// whatever their current flash model is, so this fallback doesn't go stale
// the next time they retire a dated model name (which has already happened
// twice while building this: 2.0-flash and 2.5-flash were both retired).
const MODEL_FALLBACKS = [PRIMARY_MODEL, 'gemini-flash-latest'].filter(
  (m, i, arr) => arr.indexOf(m) === i
);

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY in .env — the live demo will not work until you add it.');
}

// ---------------------------------------------------------------------------
// Audit log — every tool call and every agent decision gets written to disk,
// timestamped. A bank compliance team would require exactly this: a durable
// record of what the agent looked up and why it decided what it decided,
// independent of whatever the UI shows.
// ---------------------------------------------------------------------------
const AUDIT_LOG_PATH = path.join(__dirname, 'agent_audit.log.jsonl');
const CRM_LOG_PATH = path.join(__dirname, 'crm_actions.jsonl');

function appendJsonLine(filePath, obj) {
  fs.appendFileSync(filePath, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

function auditLog(event) {
  appendJsonLine(AUDIT_LOG_PATH, event);
}

// Mock CRM / call-log data — stands in for the real systems RM Coworker
// already has access to. The model is NOT given this directly; it has to
// call a tool to get it, same as a real agent would.
const MOCK_DATA = {
  priya: {
    client_id: 'priya_sharma',
    call_id: 'c_20250912_priya',
    compliance_topic: 'education_savings_products',
    client_profile: { tier: 'Premium', tenure_years: 6, existing_products: ['FD', 'Savings'], aum: '₹42L' },
    call_summary: { topics: ['portfolio rebalancing', "education fund — Ananya, ~24 months away"], sentiment: 'positive' }
  },
  rajesh: {
    client_id: 'rajesh_kumar',
    call_id: 'c_20250910_rajesh',
    compliance_topic: 'credit_line_increase',
    client_profile: { tier: 'SME', tenure_years: 3, existing_products: ['Current A/c', 'Term Loan'], sector: 'Manufacturing' },
    call_summary: { topics: ['business expansion', 'working capital ask'], sentiment: 'neutral, time-pressured' }
  },
  quiet: {
    client_id: 'meera_enterprises',
    call_id: null,
    compliance_topic: 'account_reactivation_outreach',
    client_profile: { tier: 'Corporate', tenure_years: 8, existing_products: ['Trade Finance', 'Payroll'], relationship_health: 'declining' },
    call_summary: { usage_change: '-40% over 3 months', last_call_logged: '94 days ago', unanswered_checkins: 2 }
  }
};

function complianceResult(topic) {
  const sensitive = ['credit_line_increase', 'account_reactivation_outreach'];
  return sensitive.includes(topic)
    ? { requires_review: true, reason: 'relationship- or credit-sensitive — requires human sign-off before sending' }
    : { requires_review: false, reason: 'informational only, no advice given yet' };
}

// executeTool is the ONLY function that would change in a real bank
// deployment — swap the bodies below for real Salesforce/CRM/compliance API
// calls and everything else (the Gemini loop, the prompt, the routing logic)
// stays identical.
function executeTool(scenario, name, args) {
  const d = MOCK_DATA[scenario];

  if (name === 'get_client_profile') return d.client_profile;
  if (name === 'get_call_transcript_summary') return d.call_summary || { note: 'no call logged this quarter' };
  if (name === 'check_compliance_flag') return complianceResult(args.topic || d.compliance_topic);

  if (name === 'log_crm_action') {
    // This is a WRITE, not a read — the agent is persisting a real decision
    // to disk, not just fetching data. This is what makes it an action-taking
    // agent instead of a read-only assistant.
    const entry = {
      client_id: d.client_id,
      scenario,
      action: args.action || '(none provided)',
      priority: args.priority || 'medium'
    };
    appendJsonLine(CRM_LOG_PATH, entry);
    return { status: 'logged', ...entry };
  }

  return { error: 'unknown tool: ' + name };
}

const TOOLS = [{
  functionDeclarations: [
    {
      name: 'get_client_profile',
      description: "Look up a bank client's CRM profile by client_id",
      parameters: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] }
    },
    {
      name: 'get_call_transcript_summary',
      description: 'Look up the summary of a logged RM call by call_id',
      parameters: { type: 'object', properties: { call_id: { type: 'string' } }, required: ['call_id'] }
    },
    {
      name: 'check_compliance_flag',
      description: 'Check whether a topic requires human compliance review before acting on it',
      parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] }
    },
    {
      name: 'log_crm_action',
      description: 'Persist the next-best-action decision to the CRM audit trail. Call this once, after you have decided what the RM should do next.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', description: 'One sentence describing the next-best-action' },
          priority: { type: 'string', description: 'low, medium, or high' }
        },
        required: ['action', 'priority']
      }
    }
  ]
}];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tries each model in MODEL_FALLBACKS in order. Within a model, retries once
// on a transient "high demand" style error with a short backoff before
// moving to the next model. This is what stops a single Google capacity
// blip from taking down a live demo.
async function callGemini(contents) {
  let lastError;

  for (const model of MODEL_FALLBACKS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${url}?key=${API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, tools: TOOLS })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));

        if (model !== MODEL_FALLBACKS[0]) {
          auditLog({ event: 'model_fallback_used', model });
        }
        return data;
      } catch (err) {
        lastError = err;
        auditLog({ event: 'gemini_call_failed', model, attempt, error: err.message });

        // "high demand" = Google's servers are briefly overloaded.
        // "quota exceeded" = the free tier's per-minute rate limit (e.g. 5
        // requests/min on gemini-3.8-flash) — Google's own error message
        // tells us how long to wait ("Please retry in 36.8s").
        const quotaMatch = err.message.match(/retry in (\d+(?:\.\d+)?)s/i);
        const isOverloaded = /high demand|overloaded|503|UNAVAILABLE/i.test(err.message);
        const isRateLimited = /quota exceeded|rate limit/i.test(err.message);

        if ((isOverloaded || isRateLimited) && attempt === 0) {
          const waitMs = quotaMatch
            ? Math.min(Number(quotaMatch[1]) * 1000 + 500, 40000) // cap at 40s so the demo doesn't hang forever
            : 800;
          auditLog({ event: 'retry_scheduled', model, waitMs, reason: isRateLimited ? 'quota' : 'overloaded' });
          await sleep(waitMs);
          continue;
        }
        break; // not retryable on this model — try the next one in the fallback list
      }
    }
  }

  throw lastError;
}

app.post('/api/run', async (req, res) => {
  const { scenario } = req.body;
  const d = MOCK_DATA[scenario];
  if (!d) return res.status(400).json({ error: 'unknown scenario: ' + scenario });

  const runId = `${scenario}_${Date.now()}`;
  auditLog({ event: 'run_started', runId, scenario, client_id: d.client_id });

  try {
    const prompt = `You are RM Coworker's Follow-Up Agent for a bank relationship manager.

Before writing anything, use the available tools to look up: the client's profile, the call summary, and whether the relevant topic needs compliance review. Do this for client_id "${d.client_id}"${d.call_id ? `, call_id "${d.call_id}"` : ' (no call_id — none logged, skip that lookup)'}, and compliance topic "${d.compliance_topic}".

Once you have that data, call log_crm_action ONCE to persist the next-best-action to the CRM audit trail.

Only after that, respond with ONLY a JSON object (no markdown fences, no extra text) with exactly these keys:
{
  "email": "the follow-up email draft, addressed appropriately, signed '[RM name]'",
  "crm": "one sentence: the next-best-action to log in the CRM",
  "crosssell": "one sentence flagging a cross-sell opportunity or stating none applies, prefixed with [RELEVANT], [POSSIBLE], or [NOT APPLICABLE]",
  "routing": "one sentence on whether this can be auto-sent or needs human review, prefixed with [AUTO] or [HUMAN REVIEW]"
}`;

    let contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const toolCalls = [];

    for (let turn = 0; turn < 8; turn++) {
      const data = await callGemini(contents);
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const fnCalls = parts.filter(p => p.functionCall);

      if (fnCalls.length === 0) {
        const text = parts.map(p => p.text || '').join('').trim();
        const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = { email: text, crm: '(unparsed)', crosssell: '(unparsed)', routing: '(unparsed)' };
        }
        auditLog({ event: 'run_completed', runId, scenario, turns: turn + 1 });
        return res.json({ toolCalls, ...parsed });
      }

      contents.push({ role: 'model', parts: fnCalls });
      const responseParts = fnCalls.map(p => {
        const result = executeTool(scenario, p.functionCall.name, p.functionCall.args || {});
        toolCalls.push({
          call: `${p.functionCall.name}(${JSON.stringify(p.functionCall.args || {})})`,
          result: JSON.stringify(result)
        });
        auditLog({ event: 'tool_call', runId, tool: p.functionCall.name, args: p.functionCall.args || {} });
        return { functionResponse: { name: p.functionCall.name, response: result } };
      });
      contents.push({ role: 'user', parts: responseParts });
    }

    auditLog({ event: 'run_timed_out', runId, scenario });
    res.status(500).json({ error: 'agent did not finish within the turn limit' });
  } catch (err) {
    auditLog({ event: 'run_failed', runId, scenario, error: err.message });
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Real observability: view the last N audit entries and CRM writes. In a
// real deployment this is what a compliance officer would pull up to review
// what the agent did and why.
app.get('/api/audit', (req, res) => {
  const readLines = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  };
  res.json({
    audit: readLines(AUDIT_LOG_PATH).slice(-50),
    crmActions: readLines(CRM_LOG_PATH).slice(-50)
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RM Coworker demo (live) running at http://localhost:${PORT}`));
