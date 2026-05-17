export interface UrgencySignal {
  signal: string;
  weight: number;
  matched: boolean;
}

export function detectUrgency(subject: string, snippet: string): UrgencySignal[] {
  const signals: UrgencySignal[] = [
    { signal: 'deadline today', weight: 40, matched: false },
    { signal: 'deadline tomorrow', weight: 25, matched: false },
    { signal: 'customer impact', weight: 35, matched: false },
    { signal: 'money/legal', weight: 35, matched: false },
    { signal: 'job offer', weight: 40, matched: false },
    { signal: 'meeting request', weight: 10, matched: false },
    { signal: 'urgent wording', weight: 15, matched: false },
    { signal: 'infrastructure', weight: 15, matched: false },
    { signal: 'migration', weight: 20, matched: false },
    { signal: 'latency', weight: 15, matched: false },
    { signal: 'observability', weight: 15, matched: false },
    { signal: 'production issue', weight: 30, matched: false },
    { signal: 'deployment', weight: 15, matched: false },
    { signal: 'rollback', weight: 20, matched: false },
    { signal: 'multiple teams', weight: 15, matched: false },
    { signal: 'promotions/sales', weight: -40, matched: false },
    { signal: 'newsletter', weight: -50, matched: false },
    { signal: 'spam/marketing', weight: -60, matched: false },
  ];

  const combinedText = `${subject} ${snippet}`.toLowerCase();

  signals.forEach(signal => {
    if (signal.signal === 'deadline today') {
      signal.matched = combinedText.includes('deadline') && combinedText.includes('today');
    } else if (signal.signal === 'deadline tomorrow') {
      signal.matched = combinedText.includes('deadline') && combinedText.includes('tomorrow');
    } else if (signal.signal === 'customer impact') {
      signal.matched = combinedText.includes('customer') || combinedText.includes('client');
    } else if (signal.signal === 'money/legal') {
      signal.matched = combinedText.includes('money') || combinedText.includes('legal') || combinedText.includes('payment');
    } else if (signal.signal === 'job offer') {
      signal.matched = combinedText.includes('offer') || combinedText.includes('salary') || combinedText.includes('joining');
    } else if (signal.signal === 'meeting request') {
      signal.matched = combinedText.includes('meeting') || combinedText.includes('call');
    } else if (signal.signal === 'urgent wording') {
      signal.matched = combinedText.includes('urgent') || combinedText.includes('asap') || combinedText.includes('immediately');
    } else if (signal.signal === 'infrastructure') {
      signal.matched = combinedText.includes('infra') || combinedText.includes('server') || combinedText.includes('database');
    } else if (signal.signal === 'migration') {
      signal.matched = combinedText.includes('migrat') || combinedText.includes('move');
    } else if (signal.signal === 'latency') {
      signal.matched = combinedText.includes('latency') || combinedText.includes('slow') || combinedText.includes('delay');
    } else if (signal.signal === 'observability') {
      signal.matched = combinedText.includes('observ') || combinedText.includes('monitor') || combinedText.includes('alert');
    } else if (signal.signal === 'production issue') {
      signal.matched = combinedText.includes('production') || combinedText.includes('outage') || combinedText.includes('incident');
    } else if (signal.signal === 'deployment') {
      signal.matched = combinedText.includes('deploy') || combinedText.includes('release');
    } else if (signal.signal === 'rollback') {
      signal.matched = combinedText.includes('rollback') || combinedText.includes('revert');
    } else if (signal.signal === 'multiple teams') {
      signal.matched = combinedText.includes('team') && (combinedText.includes('multiple') || combinedText.includes('cross'));
    } else if (signal.signal === 'promotions/sales') {
      signal.matched = combinedText.includes('promo') || combinedText.includes('sale') || combinedText.includes('discount');
    } else if (signal.signal === 'newsletter') {
      signal.matched = combinedText.includes('newsletter') || combinedText.includes('digest') || combinedText.includes('weekly');
    } else if (signal.signal === 'spam/marketing') {
      signal.matched = combinedText.includes('unsubscribe') || combinedText.includes('marketing');
    }
  });

  return signals.filter(s => s.matched);
}

export function calculateUrgencyScore(signals: UrgencySignal[]): number {
  return signals.reduce((total, signal) => total + signal.weight, 0);
}
