import { SummarizerAgent } from '../summarizer-agent';

jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Team agreed to ship by Friday.' } }],
        }),
      },
    },
  }));
});

describe('SummarizerAgent', () => {
  it('exposes metadata', () => {
    expect(SummarizerAgent.name).toBe('SummarizerAgent');
    expect(SummarizerAgent.description).toMatch(/summar/i);
    expect(SummarizerAgent.version).toBe('1.0.0');
  });

  it('short-circuits corrupted content without calling the model', async () => {
    const summary = await SummarizerAgent.run('Test Subject', '[REDACTED]');
    expect(summary).toMatch(/unable to confidently parse/i);
  });

  it('short-circuits very short content', async () => {
    const summary = await SummarizerAgent.run('Test', 'x');
    expect(summary).toMatch(/unable to confidently parse/i);
  });

  it('returns the model output for healthy content', async () => {
    const body = 'Long body that is clearly above the fifty-character minimum so the corrupted-content guard does not trip.';
    const summary = await SummarizerAgent.run('Subject', body);
    expect(summary).toBe('Team agreed to ship by Friday.');
  });
});
