import { ValidationAgent } from '../validation-agent';

describe('ValidationAgent', () => {
  it('exposes metadata', () => {
    expect(ValidationAgent.name).toBe('ValidationAgent');
    expect(ValidationAgent.description).toMatch(/validat/i);
    expect(ValidationAgent.version).toBe('1.0.0');
  });

  it('should validate valid data structure', async () => {
    const data = {
      subject: 'Test Subject',
      body: 'Test body content',
      priorityScore: 75,
    };
    const result = await ValidationAgent.run(data);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect priority score out of range', async () => {
    const data = {
      subject: 'Test',
      body: 'Test',
      priorityScore: 150, // Invalid: > 100
    };
    const result = await ValidationAgent.run(data);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('warns on placeholder text', async () => {
    const data = {
      subject: 'Hello [Company Name]',
      body: 'Dear [Job Title]',
      priorityScore: 50,
    };
    const result = await ValidationAgent.run(data);
    // Placeholder text is a warning, not an error in current impl.
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should detect suspiciously short content', async () => {
    const data = {
      subject: 'Hi',
      body: 'x',
      priorityScore: 50,
    };
    const result = await ValidationAgent.run(data);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
