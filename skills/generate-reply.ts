import { getGroqClient } from '@/lib/ai/groq';
import { ReplyDraft } from '@/types/email';

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

export async function generateReply(
  subject: string,
  threadBody: string,
  userIntent?: string
): Promise<ReplyDraft[]> {
  const prompt = `Generate 3 reply drafts for this email thread. Respond ONLY with valid JSON.

Subject: ${subject}
Thread: ${threadBody.slice(0, 2000)}
${userIntent ? `User intent: ${userIntent}` : ''}

Respond ONLY with a JSON array of exactly 3 objects:
[
  {
    "tone": "professional",
    "subject": "Re: ${subject}",
    "body": "<professional reply>"
  },
  {
    "tone": "friendly",
    "subject": "Re: ${subject}",
    "body": "<friendly reply>"
  },
  {
    "tone": "concise",
    "subject": "Re: ${subject}",
    "body": "<brief direct reply>"
  }
]`;

  const raw = await generate(prompt);
  return parseJSON<ReplyDraft[]>(raw, [
    { tone: 'professional', subject: `Re: ${subject}`, body: 'Thank you for your email. I will review and get back to you shortly.' },
    { tone: 'friendly', subject: `Re: ${subject}`, body: 'Thanks for reaching out! I\'ll take a look and follow up soon.' },
    { tone: 'concise', subject: `Re: ${subject}`, body: 'Received. Will follow up.' },
  ]);
}
