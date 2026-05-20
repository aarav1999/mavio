import { detectUrgency, calculateUrgencyScore } from '../detect-urgency';

describe('detectUrgency', () => {
  it('should detect deadline today urgency', () => {
    const signals = detectUrgency('Deadline Today', 'Please submit by end of day');
    expect(signals.some(s => s.signal === 'deadline today' && s.matched)).toBe(true);
  });

  it('should detect production issue urgency', () => {
    const signals = detectUrgency('Production Outage', 'Payment processing is down affecting customers');
    expect(signals.some(s => s.signal === 'production issue' && s.matched)).toBe(true);
  });

  it('should detect customer impact urgency', () => {
    const signals = detectUrgency('Customer Escalation', 'Client is unhappy with the service');
    expect(signals.some(s => s.signal === 'customer impact' && s.matched)).toBe(true);
  });

  it('should calculate urgency score correctly', () => {
    const signals = detectUrgency('Production Outage', 'Payment processing is down');
    const score = calculateUrgencyScore(signals);
    expect(score).toBeGreaterThan(0);
  });
});
