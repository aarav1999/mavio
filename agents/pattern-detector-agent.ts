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

export interface Pattern {
  type: 'customer_mentions' | 'unreplied_urgent' | 'team_volume' | 'recurring_topic' | 'deadline_cluster';
  description: string;
  count: number;
  severity: 'high' | 'medium' | 'low';
}

export interface PatternDetectorAgent {
  name: string;
  description: string;
  version: string;
  run(emails: Array<{ subject: string; fromEmail: string; body: string; receivedAt: Date }>): Promise<Pattern[]>;
}

export const PatternDetectorAgent: PatternDetectorAgent = {
  name: 'PatternDetectorAgent',
  description: 'Detects patterns across recent emails for proactive insights',
  version: '1.0.0',

  async run(emails): Promise<Pattern[]> {
    if (emails.length === 0) return [];

    const emailSummaries = emails.map(e => ({
      subject: e.subject,
      from: e.fromEmail,
      body: e.body?.substring(0, 500) || '',
      date: e.receivedAt.toISOString(),
    })).join('\n---\n');

    const prompt = `Analyze these ${emails.length} recent emails and detect meaningful patterns. Respond with JSON only.

Emails:
${emailSummaries}

Detect patterns such as:
- Multiple emails from the same customer/organization
- Urgent emails that haven't been replied to (check for "urgent", "asap", "deadline", "today" in subject/body)
- High volume from a specific team or department
- Recurring topics mentioned across emails
- Cluster of deadlines around the same time

Respond ONLY with a JSON array (can be empty) of objects matching:
[
  {
    "type": <"customer_mentions" | "unreplied_urgent" | "team_volume" | "recurring_topic" | "deadline_cluster">,
    "description": <short human-readable description>,
    "count": <number of emails involved>,
    "severity": <"high" | "medium" | "low">
  }
]`;

    try {
      const raw = await generate(prompt);
      
      // Parse JSON response
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const patterns = JSON.parse(cleaned) as Pattern[];
      
      // Validate and filter patterns
      return patterns.filter(p => 
        p.type && p.description && typeof p.count === 'number' && p.severity
      );
    } catch (error) {
      console.error('[PatternDetector] Failed to detect patterns:', error);
      return [];
    }
  }
};
