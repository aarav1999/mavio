/**
 * Forward subject logic — mirrors the inline helper in InboxClient.
 * Kept here to ensure the rule "don't double-prefix Fwd:" is exercised.
 */
function buildForwardSubject(subject: string): string {
  return subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`;
}

describe('buildForwardSubject', () => {
  it('prefixes Fwd: to a plain subject', () => {
    expect(buildForwardSubject('Quarterly review')).toBe('Fwd: Quarterly review');
  });

  it('does not double-prefix an already-forwarded subject', () => {
    expect(buildForwardSubject('Fwd: Quarterly review')).toBe('Fwd: Quarterly review');
  });

  it('handles empty subjects', () => {
    expect(buildForwardSubject('')).toBe('Fwd: ');
  });
});
