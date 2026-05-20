import { getGroqClient } from '@/lib/ai/groq';

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

export interface SummarizerAgent {
  name: string;
  description: string;
  version: string;
  run(subject: string, body: string): Promise<string>;
}

export const SummarizerAgent: SummarizerAgent = {
  name: 'SummarizerAgent',
  description: 'Generates concise executive-style summaries of email content',
  version: '1.0.0',

  async run(subject: string, body: string): Promise<string> {
    const content = body || subject || '';

    // Detect corrupted/incomplete content
    const isCorrupted = content.length < 50 || content.includes('[REDACTED]') || content.includes('Unable to display');
    if (isCorrupted) {
      return 'Unable to confidently parse the email due to corrupted or incomplete encoding.';
    }

    const prompt = `Summarize this email in a sharp, operational, executive style. Be concise and direct. Focus on:
- Key decisions or agreements
- Action items taken
- Deadlines or timelines
- Teams or people involved

Rules:
- Use active voice (e.g., "Team agreed" not "The team has agreed")
- Avoid verbose phrases like "The outcome of this approach is dependent on"
- Keep to 2-3 short sentences maximum
- Prefer bullet-point style compressed summaries
- Ignore single-character entities

Subject: ${subject}
Body: ${content.slice(0, 2000)}

Summary (2-3 short sentences, operational style):`;

    return generate(prompt);
  }
};
