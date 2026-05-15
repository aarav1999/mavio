import Groq from 'groq-sdk';
import { AIAction, ReplyDraft, PriorityLabel } from '@/types/email';

const MODEL = 'llama-3.3-70b-versatile';

function getClient(): Groq {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! });
}

async function generate(prompt: string): Promise<string> {
  const groq = getClient();
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1024,
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

export function parseJSON<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export async function generateSummary(subject: string, body: string): Promise<string> {
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

export async function assessConfidence(subject: string, body: string): Promise<'high' | 'medium' | 'low'> {
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

// ─── Email Category Classification ───────────────────────────────────────────

export type EmailCategory = 'work' | 'personal' | 'promotions' | 'social' | 'spam' | 'system';

export async function classifyEmailCategory(
  subject: string,
  fromEmail: string,
  body: string
): Promise<EmailCategory> {
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

// ─── Priority ─────────────────────────────────────────────────────────────────

export interface PriorityResult {
  score: number;
  label: PriorityLabel;
  whyItMatters: string;
  urgency: string;
  factors: string[];
}

export async function analyzePriority(
  subject: string,
  fromEmail: string,
  snippet: string
): Promise<PriorityResult> {
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
}

// ─── Action Extraction ────────────────────────────────────────────────────────

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

// ─── Next Steps ───────────────────────────────────────────────────────────────

export async function suggestNextSteps(subject: string, body: string): Promise<string> {
  const prompt = `Given this email, what is the single best next step for the recipient? Be concise (max 15 words).

Subject: ${subject}
Body: ${body.slice(0, 1500)}

Next step:`;

  return generate(prompt);
}

// ─── Full AI Analysis (batched single call) ───────────────────────────────────

export interface FullAnalysis {
  summary: string;
  priorityScore: number;
  priorityLabel: PriorityLabel;
  whyItMatters: string;
  urgency: string;
  actions: AIAction[];
  nextSteps: string;
}

export async function analyzeEmail(
  subject: string,
  fromEmail: string,
  body: string,
  snippet: string
): Promise<FullAnalysis> {
  const prompt = `Analyze this email comprehensively. Respond ONLY with valid JSON.

Subject: ${subject}
From: ${fromEmail}
Preview: ${snippet}
Body: ${body.slice(0, 2000)}

Respond ONLY with valid JSON matching this exact schema (no markdown, no extra text):
{
  "summary": "<1-2 sentence summary>",
  "priorityScore": <1-10 integer>,
  "priorityLabel": <"urgent"|"important"|"normal"|"low">,
  "whyItMatters": "<one sentence why this matters>",
  "urgency": "<one sentence about timeline>",
  "actions": [
    {
      "label": "<action label>",
      "type": <"follow_up"|"meeting_request"|"customer_escalation"|"requires_response"|"fyi"|"deadline">,
      "dueDate": null
    }
  ],
  "nextSteps": "<best next step in 15 words or less>"
}`;

  const raw = await generate(prompt);
  return parseJSON<FullAnalysis>(raw, {
    summary: snippet,
    priorityScore: 5,
    priorityLabel: 'normal',
    whyItMatters: 'Standard email requiring attention.',
    urgency: 'No specific deadline.',
    actions: [],
    nextSteps: 'Review and respond as appropriate.',
  });
}

// ─── Reply Drafts ─────────────────────────────────────────────────────────────

export async function generateReplyDrafts(
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

// ─── Streaming Summary ─────────────────────────────────────────────────────────

export async function* streamSummary(
  subject: string,
  body: string
): AsyncGenerator<string> {
  const groq = getClient();
  const content = body || subject || '';
  const prompt = `Summarize this email in 2-3 sentences. Use ONLY the actual content from the email below. DO NOT use placeholders like [Company Name], [Job Title], [Date], etc. Extract real names, real companies, and real details from the text. Be specific about key points and any required actions.

Subject: ${subject}
Body: ${content.slice(0, 2000)}

Summary:`;

  const stream = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 512,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) yield text;
  }
}
