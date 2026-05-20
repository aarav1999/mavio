import { getGroqClient } from '@/lib/ai/groq';
import { AIAction } from '@/types/email';

// NOTE: This skill makes AI calls via the shared Groq singleton.
// It is classified as a "thin skill wrapper" and tested with mocked Groq.

const MODEL = 'llama-3.3-70b-versatile';

async function generate(prompt: string): Promise<string> {
  const groq = getGroqClient();
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1024,
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export async function extractActions(subject: string, body: string): Promise<AIAction[]> {
  const prompt = `Extract actionable items from this email. Respond with JSON only.

Subject: ${subject}
Body: ${body.slice(0, 2000)}

Respond ONLY with a JSON array (can be empty) of objects matching:
[
  {
    "label": "<short action label>",
    "type": <"follow_up"|"meeting_request"|"customer_escalation"|"requires_response"|"fyi"|"deadline">,
    "dueDate": "<optional date string or null>"
  }
]`;

  const raw = await generate(prompt);
  return parseJSON<AIAction[]>(raw, []);
}
