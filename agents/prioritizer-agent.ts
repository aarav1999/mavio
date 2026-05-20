import { getGroqClient } from '@/lib/ai/groq';
import { PriorityLabel } from '@/types/email';

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

export interface PriorityResult {
  score: number;
  label: PriorityLabel;
  whyItMatters: string;
  urgency: string;
  factors: string[];
}

export interface PrioritizerAgent {
  name: string;
  description: string;
  version: string;
  run(subject: string, fromEmail: string, snippet: string): Promise<PriorityResult>;
  assessConfidence(subject: string, body: string): Promise<'high' | 'medium' | 'low'>;
}

function parseJSON<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export const PrioritizerAgent: PrioritizerAgent = {
  name: 'PrioritizerAgent',
  description: 'Analyzes email priority using weighted signal scoring and provides explainable factors',
  version: '1.0.0',

  async run(subject: string, fromEmail: string, snippet: string): Promise<PriorityResult> {
    const prompt = `Analyze the priority of this email using weighted signal scoring. Respond with JSON only.

Subject: ${subject}
From: ${fromEmail}
Preview: ${snippet}

Score signals (add up matching signals):
- Deadline today: +40
- Deadline tomorrow: +25
- Customer impact: +35
- Money/legal: +35
- Job offer: +40 (CTC, salary, joining date, offer letter)
- Meeting request: +10
- Urgent wording (asap, urgent, immediately): +15
- Infrastructure: +15
- Migration: +20
- Latency: +15
- Observability: +15
- Production issue: +30 (highest weight - payment outage, customers affected)
- Deployment: +15
- Rollback discussion: +20
- Multiple teams involved: +15
- Promotions/sales: -40
- Newsletter: -50
- Spam/marketing: -60

Thresholds (MUST match score to label correctly):
- score >= 90: URGENT
- score >= 60: IMPORTANT
- score >= 30: NORMAL
- score < 30: LOW

Respond ONLY with valid JSON matching this exact schema:
{
  "score": <integer total score>,
  "label": <"urgent"|"important"|"normal"|"low">,
  "whyItMatters": "<one sentence why this email matters - be precise, avoid hallucinating 'production issue' if it's just encoding/attachment issues>",
  "urgency": "<one sentence about timeline or urgency>",
  "factors": ["<factor1>", "<factor2>", ...] // List ALL signals that matched from the scoring list above
}`;

    const raw = await generate(prompt);
    const result = parseJSON<PriorityResult>(raw, {
      score: 5,
      label: 'low',
      whyItMatters: 'Standard email requiring attention.',
      urgency: 'No specific deadline indicated.',
      factors: [],
    });

    // Ensure label matches score (override if AI got it wrong)
    if (result.score >= 90) result.label = 'urgent';
    else if (result.score >= 60) result.label = 'important';
    else if (result.score >= 30) result.label = 'normal';
    else result.label = 'low';

    return result;
  },

  async assessConfidence(subject: string, body: string): Promise<'high' | 'medium' | 'low'> {
    const content = body || subject || '';

    // LOW confidence: only for truly corrupted or problematic content
    const isCorrupted = content.length < 20 || content.includes('[REDACTED]') || content.includes('Unable to display');
    const hasEncodingIssues = (content.match(/[^\x20-\x7E]/g) || []).length / content.length > 0.3; // >30% non-ASCII
    const isPromotionalNoise = content.toLowerCase().includes('unsubscribe') && content.toLowerCase().includes('limited time');

    if (isCorrupted || hasEncodingIssues || isPromotionalNoise) {
      return 'low';
    }

    // MEDIUM confidence: corrupted encoding, malformed payload, ambiguity, missing structured context
    const hasMalformedEncoding = content.includes('') || content.includes('') || content.includes('?');
    const hasAttachmentIssues = content.toLowerCase().includes('attachment') && content.toLowerCase().includes('error');
    const hasAmbiguity = content.toLowerCase().includes('someone should') || content.toLowerCase().includes('whoever');
    const vagueWording = content.toLowerCase().includes('maybe sometime') || content.toLowerCase().includes('at some point');
    const isPartiallyCorrupted = content.length < 100 || (content.match(/[^\w\s.,!?@]/g) || []).length / content.length > 0.2;

    if (hasMalformedEncoding || hasAttachmentIssues || hasAmbiguity || vagueWording || isPartiallyCorrupted) {
      return 'medium';
    }

    // HIGH confidence: clear, structured content (default for most emails)
    return 'high';
  }
};
