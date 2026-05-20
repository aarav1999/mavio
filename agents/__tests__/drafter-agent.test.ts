import { DrafterAgent } from '../drafter-agent';

// Mock Groq SDK so we never hit the network in unit tests.
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { tone: 'professional', subject: 'Re: Test', body: 'Professional reply.' },
                  { tone: 'friendly', subject: 'Re: Test', body: 'Friendly reply!' },
                  { tone: 'concise', subject: 'Re: Test', body: 'OK.' },
                ]),
              },
            },
          ],
        }),
      },
    },
  }));
});

describe('DrafterAgent', () => {
  it('exposes correct metadata', () => {
    expect(DrafterAgent.name).toBe('DrafterAgent');
    expect(DrafterAgent.description).toMatch(/3 reply drafts/i);
    expect(DrafterAgent.version).toBe('1.0.0');
  });

  it('returns three drafts', async () => {
    const drafts = await DrafterAgent.run('Test', 'Body');
    expect(drafts).toHaveLength(3);
  });

  it('returns professional, friendly, and concise tones', async () => {
    const drafts = await DrafterAgent.run('Test', 'Body');
    const tones = drafts.map((d) => d.tone);
    expect(tones).toEqual(expect.arrayContaining(['professional', 'friendly', 'concise']));
  });

  it('falls back to canned drafts on malformed JSON', async () => {
    // Override the mock for this single case to return invalid JSON.
    const Groq = require('groq-sdk');
    (Groq as jest.Mock).mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'not-json-at-all' } }],
          }),
        },
      },
    }));

    const drafts = await DrafterAgent.run('Test', 'Body');
    expect(drafts).toHaveLength(3);
    expect(drafts[0].tone).toBe('professional');
  });
});
