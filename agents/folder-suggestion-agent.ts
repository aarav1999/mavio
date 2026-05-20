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

export interface FolderSuggestion {
  action: 'move_to_folder' | 'label_as' | 'archive' | 'mark_read';
  target: string; // folder name or label
  emailIds: string[];
  reason: string;
  count: number;
}

export interface FolderSuggestionAgent {
  name: string;
  description: string;
  version: string;
  run(emails: Array<{ id: string; subject: string; fromEmail: string; body: string; aiCategory?: string; aiPriorityLabel?: string }>): Promise<FolderSuggestion[]>;
}

export const FolderSuggestionAgent: FolderSuggestionAgent = {
  name: 'FolderSuggestionAgent',
  description: 'Suggests folder organization actions based on email classification',
  version: '1.0.0',

  async run(emails): Promise<FolderSuggestion[]> {
    if (emails.length === 0) return [];

    const emailSummaries = emails.map(e => ({
      id: e.id,
      subject: e.subject,
      from: e.fromEmail,
      body: e.body?.substring(0, 300) || '',
      category: e.aiCategory || 'uncategorized',
      priority: e.aiPriorityLabel || 'unknown',
    })).join('\n---\n');

    const prompt = `Analyze these ${emails.length} emails and suggest folder organization actions. Respond with JSON only.

Emails:
${emailSummaries}

Suggest actions like:
- Move promotional emails to "Promotions" folder
- Archive old newsletters
- Label engineering emails as "Work"
- Move low-priority emails to "Later"
- Mark read for non-urgent notifications

Respond ONLY with a JSON array (can be empty) of objects matching:
[
  {
    "action": <"move_to_folder" | "label_as" | "archive" | "mark_read">,
    "target": <folder name or label>,
    "emailIds": <array of email IDs from the input>,
    "reason": <short explanation>,
    "count": <number of emails>
  }
]

Only suggest actions for 3+ emails to avoid clutter. Prioritize high-impact actions.`;

    try {
      const raw = await generate(prompt);
      
      // Parse JSON response
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const suggestions = JSON.parse(cleaned) as FolderSuggestion[];
      
      // Validate and filter suggestions
      return suggestions.filter(s => 
        s.action && s.target && Array.isArray(s.emailIds) && s.reason && typeof s.count === 'number'
      );
    } catch (error) {
      console.error('[FolderSuggestion] Failed to generate suggestions:', error);
      return [];
    }
  }
};
