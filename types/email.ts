export interface ParsedEmail {
  id: string;
  threadId: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  snippet: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  receivedAt: Date;
  accountId?: string;
  provider?: string;
}

export interface EmailWithAI extends ParsedEmail {
  aiSummary?: string | null;
  aiPriorityScore?: number | null;
  aiPriorityLabel?: 'urgent' | 'important' | 'normal' | 'low' | null;
  aiActions?: AIAction[] | null;
  aiUrgency?: string | null;
  aiWhyItMatters?: string | null;
  aiNextSteps?: string | null;
  aiCategory?: 'work' | 'personal' | 'promotions' | 'social' | 'spam' | null;
  aiPriorityFactors?: string[] | null;
  aiConfidence?: 'high' | 'medium' | 'low' | null;
}

export interface AIAction {
  label: string;
  type: 'follow_up' | 'meeting_request' | 'customer_escalation' | 'requires_response' | 'fyi' | 'deadline';
  dueDate?: string;
}

export interface ReplyDraft {
  tone: 'professional' | 'friendly' | 'concise' | 'forward';
  subject: string;
  body: string;
}

export interface GmailMessage {
  id?: string | null;
  threadId?: string | null;
  labelIds?: string[] | null;
  snippet?: string | null;
  internalDate?: string | null;
  payload?: {
    headers?: Array<{ name?: string | null; value?: string | null }>;
    mimeType?: string | null;
    body?: { data?: string | null; size?: number | null };
    parts?: any[];
  };
}

export interface EmailThread {
  id?: string | null;
  historyId?: string | null;
  messages?: GmailMessage[];
}

export interface EmailProvider {
  id: string;
  type: 'gmail' | 'outlook' | 'imap';
  email: string;
  name: string;
  avatarUrl?: string;
  accessToken: string;
}

export type PriorityLabel = 'urgent' | 'important' | 'normal' | 'low';

export interface InboxFilter {
  label?: string;
  search?: string;
  provider?: string;
  showArchived?: boolean;
}
