import { SummarizerAgent } from '@/agents/summarizer-agent';
import { PrioritizerAgent } from '@/agents/prioritizer-agent';
import { ClassifierAgent } from '@/agents/classifier-agent';
import { DrafterAgent } from '@/agents/drafter-agent';
import { ValidationAgent } from '@/agents/validation-agent';
import { onEmailReceived } from '@/hooks/on-email-received';
import { onAnalysisComplete } from '@/hooks/on-analysis-complete';
import { onReplyGenerated } from '@/hooks/on-reply-generated';

export interface EmailInput {
  id: string;
  subject: string;
  fromEmail: string;
  body: string;
  snippet: string;
  receivedAt: Date;
}

export interface ProcessedEmail {
  email: EmailInput;
  classification: string;
  priority: {
    score: number;
    label: string;
    whyItMatters: string;
    urgency: string;
    factors: string[];
  };
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  replies: Array<{
    tone: string;
    subject: string;
    body: string;
  }>;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Simple orchestrator function that coordinates AI agents to process an email.
 * No complex orchestration or distributed systems - independent agents run in parallel.
 * 
 * This is the core "multi-agent" workflow - Classifier, Summarizer, and Drafter run
 * in parallel (no inter-dependencies), while Prioritizer and Validation run sequentially.
 */
export async function processEmail(email: EmailInput): Promise<ProcessedEmail> {

  // Trigger email received hook
  await onEmailReceived(email);

  // Run independent agents in parallel for performance
  const [classification, summary, replies] = await Promise.all([
    ClassifierAgent.run(email.subject, email.fromEmail, email.body),
    SummarizerAgent.run(email.subject, email.body),
    DrafterAgent.run(email.subject, email.body),
  ]);

  // Run dependent agents sequentially
  const priority = await PrioritizerAgent.run(email.subject, email.fromEmail, email.snippet);
  const confidence = await PrioritizerAgent.assessConfidence(email.subject, email.body);

  // Validate results
  const validation = await ValidationAgent.run({
    subject: email.subject,
    body: email.body,
    priorityScore: priority.score,
  });

  // Trigger analysis complete hook
  await onAnalysisComplete({
    summary,
    priorityScore: priority.score,
    priorityLabel: priority.label,
    actions: [],
    confidence,
  });

  // Trigger reply generated hook for each draft
  for (const reply of replies) {
    await onReplyGenerated(reply);
  }

  return {
    email,
    classification,
    priority,
    summary,
    confidence,
    replies,
    validation,
  };
}

/**
 * Lightweight orchestrator that only runs specific agents.
 * Useful when you only need partial analysis.
 */
export async function processEmailPartial(
  email: EmailInput,
  options: {
    summary?: boolean;
    priority?: boolean;
    classification?: boolean;
    replies?: boolean;
  } = {}
): Promise<Partial<ProcessedEmail>> {
  const result: Partial<ProcessedEmail> = { email };

  if (options.summary) {
    result.summary = await SummarizerAgent.run(email.subject, email.body);
  }

  if (options.priority) {
    result.priority = await PrioritizerAgent.run(email.subject, email.fromEmail, email.snippet);
  }

  if (options.classification) {
    result.classification = await ClassifierAgent.run(email.subject, email.fromEmail, email.body);
  }

  if (options.replies) {
    result.replies = await DrafterAgent.run(email.subject, email.body);
  }

  return result;
}
