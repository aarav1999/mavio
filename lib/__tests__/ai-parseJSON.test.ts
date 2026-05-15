import { parseJSON } from '../ai/gemini';

describe('parseJSON (AI response cleaner)', () => {
  it('parses clean JSON', () => {
    expect(parseJSON('{"score": 8}', { score: 0 })).toEqual({ score: 8 });
  });

  it('strips ```json fences from LLM output', () => {
    const raw = '```json\n{"label": "urgent"}\n```';
    expect(parseJSON(raw, { label: '' })).toEqual({ label: 'urgent' });
  });

  it('strips plain ``` fences', () => {
    const raw = '```\n{"a": 1}\n```';
    expect(parseJSON(raw, { a: 0 })).toEqual({ a: 1 });
  });

  it('returns fallback on malformed JSON', () => {
    expect(parseJSON('not json at all', { ok: false })).toEqual({ ok: false });
  });

  it('returns fallback on empty input', () => {
    expect(parseJSON('', [] as string[])).toEqual([]);
  });

  it('parses arrays', () => {
    const raw = '```json\n[{"tone":"professional"},{"tone":"friendly"}]\n```';
    expect(parseJSON(raw, [])).toEqual([
      { tone: 'professional' },
      { tone: 'friendly' },
    ]);
  });

  it('handles JSON with whitespace and trailing content gracefully', () => {
    const raw = '   {"x": 42}   ';
    expect(parseJSON(raw, { x: 0 })).toEqual({ x: 42 });
  });
});
