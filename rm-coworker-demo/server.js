require('dotenv').config();
const express = require('express');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY in .env — the live demo will not work until you add it.');
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

function executeTool(scenario, name, args) {
  const d = MOCK_DATA[scenario];
  if (name === 'get_client_profile') return d.client_profile;
  if (name === 'get_call_transcript_summary') return d.call_summary || { note: 'no call logged this quarter' };
  if (name === 'check_compliance_flag') return complianceResult(args.topic || d.compliance_topic);
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
    }
  ]
}];

async function callGemini(contents) {
  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, tools: TOOLS })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
  return data;
}

app.post('/api/run', async (req, res) => {
  try {
    const { scenario } = req.body;
    const d = MOCK_DATA[scenario];
    if (!d) return res.status(400).json({ error: 'unknown scenario: ' + scenario });

    const prompt = `You are RM Coworker's Follow-Up Agent for a bank relationship manager.

Before writing anything, use the available tools to look up: the client's profile, the call summary, and whether the relevant topic needs compliance review. Do this for client_id "${d.client_id}"${d.call_id ? `, call_id "${d.call_id}"` : ' (no call_id — none logged, skip that lookup)'}, and compliance topic "${d.compliance_topic}".

Once you have that data, respond with ONLY a JSON object (no markdown fences, no extra text) with exactly these keys:
{
  "email": "the follow-up email draft, addressed appropriately, signed '[RM name]'",
  "crm": "one sentence: the next-best-action to log in the CRM",
  "crosssell": "one sentence flagging a cross-sell opportunity or stating none applies, prefixed with [RELEVANT], [POSSIBLE], or [NOT APPLICABLE]",
  "routing": "one sentence on whether this can be auto-sent or needs human review, prefixed with [AUTO] or [HUMAN REVIEW]"
}`;

    let contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const toolCalls = [];

    for (let turn = 0; turn < 6; turn++) {
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
        return res.json({ toolCalls, ...parsed });
      }

      contents.push({ role: 'model', parts: fnCalls.map(p => ({ functionCall: p.functionCall })) });
      const responseParts = fnCalls.map(p => {
        const result = executeTool(scenario, p.functionCall.name, p.functionCall.args || {});
        toolCalls.push({
          call: `${p.functionCall.name}(${JSON.stringify(p.functionCall.args || {})})`,
          result: JSON.stringify(result)
        });
        return { functionResponse: { name: p.functionCall.name, response: result } };
      });
      contents.push({ role: 'function', parts: responseParts });
    }

    res.status(500).json({ error: 'agent did not finish within the turn limit' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RM Coworker demo (live) running at http://localhost:${PORT}`));
