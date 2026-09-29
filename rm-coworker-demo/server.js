require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.GROQ_API_KEY;
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
// Groq's free tier has generous but still finite per-model rate limits.
// If the primary model is rate-limited or down, fall back to a second
// tool-use-capable model instead of just failing the request.
const MODEL_FALLBACKS = [PRIMARY_MODEL, 'llama-3.1-8b-instant'].filter(
  (m, i, arr) => arr.indexOf(m) === i
);
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!API_KEY) {
  console.error('Missing GROQ_API_KEY in .env — the live demo will not work until you add it. Get one free at https://console.groq.com/keys');
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
// calls and everything else (the agent loop, the prompt, the routing logic)
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

// Groq's API is OpenAI-compatible: tools are declared as
// { type: 'function', function: { name, description, parameters } }
// rather than Gemini's { functionDeclarations: [...] }.
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_client_profile',
      description: "Look up a bank client's CRM profile by client_id",
      parameters: { type: 'object', properties: { client_id: { type: 'string' } }, required: ['client_id'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_call_transcript_summary',
      description: 'Look up the summary of a logged RM call by call_id',
      parameters: { type: 'object', properties: { call_id: { type: 'string' } }, required: ['call_id'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_compliance_flag',
      description: 'Check whether a topic requires human compliance review before acting on it',
      parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] }
    }
  },
  {
    type: 'function',
    function: {
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
  }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tries each model in MODEL_FALLBACKS in order. Within a model, retries once
// on a transient rate-limit error, honoring Groq's own suggested wait time
// when it gives one, before moving to the next model.
async function callGroq(messages) {
  let lastError;

  for (const model of MODEL_FALLBACKS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`
          },
          body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));

        if (model !== MODEL_FALLBACKS[0]) {
          auditLog({ event: 'model_fallback_used', model });
        }
        return data;
      } catch (err) {
        lastError = err;
        auditLog({ event: 'groq_call_failed', model, attempt, error: err.message });

        const retryMatch = err.message.match(/try again in (\d+(?:\.\d+)?)s/i);
        const isRateLimited = /rate limit|429|quota/i.test(err.message);
        const isOverloaded = /503|UNAVAILABLE|overloaded/i.test(err.message);

        if ((isRateLimited || isOverloaded) && attempt === 0) {
          const waitMs = retryMatch ? Math.min(Number(retryMatch[1]) * 1000 + 300, 15000) : 800;
          auditLog({ event: 'retry_scheduled', model, waitMs, reason: isRateLimited ? 'rate_limit' : 'overloaded' });
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
    const systemPrompt = `You are RM Coworker's Follow-Up Agent for a bank relationship manager.

Before writing anything, use the available tools to look up: the client's profile, the call summary, and whether the relevant topic needs compliance review. Do this for client_id "${d.client_id}"${d.call_id ? `, call_id "${d.call_id}"` : ' (no call_id — none logged, skip that lookup)'}, and compliance topic "${d.compliance_topic}".

Once you have that data, call log_crm_action ONCE to persist the next-best-action to the CRM audit trail.

Only after that, respond with ONLY a JSON object (no markdown fences, no extra text) with exactly these keys:
{
  "email": "the follow-up email draft, addressed appropriately, signed '[RM name]'",
  "crm": "one sentence: the next-best-action to log in the CRM",
  "crosssell": "one sentence flagging a cross-sell opportunity or stating none applies, prefixed with [RELEVANT], [POSSIBLE], or [NOT APPLICABLE]",
  "routing": "one sentence on whether this can be auto-sent or needs human review, prefixed with [AUTO] or [HUMAN REVIEW]"
}`;

    let messages = [{ role: 'system', content: systemPrompt }];
    const toolCalls = [];

    for (let turn = 0; turn < 8; turn++) {
      const data = await callGroq(messages);
      const message = data.choices?.[0]?.message || {};
      const calls = message.tool_calls || [];

      if (calls.length === 0) {
        const text = (message.content || '').trim();
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

      messages.push({ role: 'assistant', content: message.content || null, tool_calls: calls });

      for (const call of calls) {
        const args = JSON.parse(call.function.arguments || '{}');
        const result = executeTool(scenario, call.function.name, args);
        toolCalls.push({
          call: `${call.function.name}(${JSON.stringify(args)})`,
          result: JSON.stringify(result)
        });
        auditLog({ event: 'tool_call', runId, tool: call.function.name, args });
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
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
app.listen(PORT, () => console.log(`RM Coworker demo (live, Groq) running at http://localhost:${PORT}`));
