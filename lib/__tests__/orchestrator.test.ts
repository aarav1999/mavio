import { processEmail, processEmailPartial, EmailInput } from '../orchestrator';

jest.mock('@/agents/summarizer-agent', () => ({
  SummarizerAgent: { run: jest.fn().mockResolvedValue('A short summary.') },
}));
jest.mock('@/agents/prioritizer-agent', () => ({
  PrioritizerAgent: {
    run: jest.fn().mockResolvedValue({
      score: 75,
      label: 'important',
      whyItMatters: 'Customer asked.',
      urgency: 'today',
      factors: ['customer impact'],
    }),
    assessConfidence: jest.fn().mockResolvedValue('high'),
  },
}));
jest.mock('@/agents/classifier-agent', () => ({
  ClassifierAgent: { run: jest.fn().mockResolvedValue('work') },
}));
jest.mock('@/agents/drafter-agent', () => ({
  DrafterAgent: {
    run: jest.fn().mockResolvedValue([
      { tone: 'professional', subject: 'Re: x', body: 'pro' },
      { tone: 'friendly', subject: 'Re: x', body: 'fri' },
      { tone: 'concise', subject: 'Re: x', body: 'con' },
    ]),
  },
}));
jest.mock('@/agents/validation-agent', () => ({
  ValidationAgent: {
    run: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
  },
}));
jest.mock('@/hooks/on-email-received', () => ({
  onEmailReceived: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/hooks/on-analysis-complete', () => ({
  onAnalysisComplete: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/hooks/on-reply-generated', () => ({
  onReplyGenerated: jest.fn().mockResolvedValue(undefined),
}));

const sampleEmail: EmailInput = {
  id: 'msg-1',
  subject: 'Customer escalation',
  fromEmail: 'customer@acme.com',
  body: 'Our prod is down, please help.',
  snippet: 'Our prod is down...',
  receivedAt: new Date('2026-05-17T10:00:00Z'),
};

describe('orchestrator.processEmail', () => {
  it('returns a fully populated ProcessedEmail and triggers all hooks', async () => {
    const { onEmailReceived } = require('@/hooks/on-email-received');
    const { onAnalysisComplete } = require('@/hooks/on-analysis-complete');
    const { onReplyGenerated } = require('@/hooks/on-reply-generated');

    const result = await processEmail(sampleEmail);

    expect(result.classification).toBe('work');
    expect(result.priority.label).toBe('important');
    expect(result.summary).toBe('A short summary.');
    expect(result.confidence).toBe('high');
    expect(result.replies).toHaveLength(3);
    expect(result.validation.isValid).toBe(true);

    expect(onEmailReceived).toHaveBeenCalledTimes(1);
    expect(onAnalysisComplete).toHaveBeenCalledTimes(1);
    // One per draft.
    expect(onReplyGenerated).toHaveBeenCalledTimes(3);
  });

  it('processEmailPartial only invokes requested agents', async () => {
    const { SummarizerAgent } = require('@/agents/summarizer-agent');
    const { ClassifierAgent } = require('@/agents/classifier-agent');
    SummarizerAgent.run.mockClear();
    ClassifierAgent.run.mockClear();

    const result = await processEmailPartial(sampleEmail, { summary: true });

    expect(SummarizerAgent.run).toHaveBeenCalledTimes(1);
    expect(ClassifierAgent.run).not.toHaveBeenCalled();
    expect(result.summary).toBe('A short summary.');
    expect(result.classification).toBeUndefined();
  });
});
