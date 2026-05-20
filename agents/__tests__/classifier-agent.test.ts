import { ClassifierAgent } from '../classifier-agent';

let mockResponse = 'work';
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async () => ({
          choices: [{ message: { content: mockResponse } }],
        })),
      },
    },
  }));
});

describe('ClassifierAgent', () => {
  it('exposes metadata', () => {
    expect(ClassifierAgent.name).toBe('ClassifierAgent');
    expect(ClassifierAgent.description).toMatch(/classif/i);
    expect(ClassifierAgent.version).toBe('1.0.0');
  });

  it('returns work when model says work', async () => {
    mockResponse = 'work';
    expect(await ClassifierAgent.run('Subject', 'a@b.com', 'Body')).toBe('work');
  });

  it('returns personal when model says personal', async () => {
    mockResponse = 'personal';
    expect(await ClassifierAgent.run('Subject', 'a@b.com', 'Body')).toBe('personal');
  });

  it('returns system when model says system', async () => {
    mockResponse = 'system';
    expect(await ClassifierAgent.run('Subject', 'a@b.com', 'Body')).toBe('system');
  });

  it('falls back to work when model returns garbage', async () => {
    mockResponse = 'gibberish-not-a-category';
    expect(await ClassifierAgent.run('Subject', 'a@b.com', 'Body')).toBe('work');
  });
});
