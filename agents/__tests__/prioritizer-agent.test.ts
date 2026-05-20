import { PrioritizerAgent } from '../prioritizer-agent';

let modelOutput = '{"score": 95, "label": "low", "whyItMatters": "x", "urgency": "y", "factors": []}';
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async () => ({
          choices: [{ message: { content: modelOutput } }],
        })),
      },
    },
  }));
});

describe('PrioritizerAgent', () => {
  it('exposes metadata', () => {
    expect(PrioritizerAgent.name).toBe('PrioritizerAgent');
    expect(PrioritizerAgent.description).toMatch(/priority/i);
    expect(PrioritizerAgent.version).toBe('1.0.0');
  });

  it('overrides the label when score does not match (urgent)', async () => {
    modelOutput = JSON.stringify({ score: 95, label: 'low', whyItMatters: 'x', urgency: 'y', factors: [] });
    const r = await PrioritizerAgent.run('Subject', 'a@b.com', 'snippet');
    expect(r.label).toBe('urgent');
  });

  it('overrides the label when score does not match (normal)', async () => {
    modelOutput = JSON.stringify({ score: 35, label: 'urgent', whyItMatters: 'x', urgency: 'y', factors: [] });
    const r = await PrioritizerAgent.run('Subject', 'a@b.com', 'snippet');
    expect(r.label).toBe('normal');
  });

  it('falls back to a low-priority result on JSON parse failure', async () => {
    modelOutput = 'not json';
    const r = await PrioritizerAgent.run('Subject', 'a@b.com', 'snippet');
    expect(r.label).toBe('low');
    expect(r.score).toBeLessThan(30);
  });

  it('should assess confidence for clear content', async () => {
    const confidence = await PrioritizerAgent.assessConfidence('Meeting Tomorrow', 'Let\'s meet tomorrow at 2pm to discuss the project timeline');
    expect(['high', 'medium']).toContain(confidence);
  });

  it('should assess low confidence for corrupted content', async () => {
    const confidence = await PrioritizerAgent.assessConfidence('Test', '[REDACTED]');
    expect(confidence).toBe('low');
  });

  it('should assess medium confidence for ambiguous content', async () => {
    const confidence = await PrioritizerAgent.assessConfidence('Question', 'Someone should look into this at some point');
    expect(['medium', 'low']).toContain(confidence);
  });
});
