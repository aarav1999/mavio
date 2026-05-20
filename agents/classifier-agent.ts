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

export type EmailCategory = 'work' | 'personal' | 'promotions' | 'social' | 'spam' | 'system';

export interface ClassifierAgent {
  name: string;
  description: string;
  version: string;
  run(subject: string, fromEmail: string, body: string): Promise<EmailCategory>;
}

export const ClassifierAgent: ClassifierAgent = {
  name: 'ClassifierAgent',
  description: 'Classifies emails into categories: work, personal, promotions, social, spam, system',
  version: '1.0.0',

  async run(subject: string, fromEmail: string, body: string): Promise<EmailCategory> {
    const prompt = `Classify this email into one of these categories: work, personal, promotions, social, spam, system.

Subject: ${subject}
From: ${fromEmail}
Body: ${body.slice(0, 1000)}

Rules:
- work: Professional emails, business updates, collaboration, internal comms, client communications
- personal: Friends, family, personal messages, non-work related
- promotions: Sales, marketing, discounts, newsletters, promotional content
- social: Social media notifications, friend requests, platform updates
- spam: Phishing, scams, unsolicited bulk, suspicious content
- system: Technical errors, encoding issues, operational alerts, system notifications, automated messages

IMPORTANT: Do NOT classify corrupted, malformed, or technical emails as spam. These should be classified as 'system' if they appear to be operational or technical in nature.

Respond with ONLY one word: work, personal, promotions, social, spam, or system`;

    const raw = await generate(prompt);
    const normalized = raw.toLowerCase().trim();
    if (['work', 'personal', 'promotions', 'social', 'spam', 'system'].includes(normalized)) {
      return normalized as EmailCategory;
    }
    return 'work'; // Default fallback
  }
};
