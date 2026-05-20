import { consumeQuota, __resetQuotaForTests } from '../quota-guard';

describe('consumeQuota', () => {
  beforeEach(() => __resetQuotaForTests());

  it('allows the first call and reports remaining headroom', async () => {
    const r = await consumeQuota('user-1', { perUserPerDay: 5 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
    expect(r.limit).toBe(5);
    expect(r.resetSeconds).toBeGreaterThan(0);
  });

  it('blocks once the per-user daily cap is hit', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await consumeQuota('user-1', { perUserPerDay: 5 })).allowed).toBe(true);
    }
    const blocked = await consumeQuota('user-1', { perUserPerDay: 5 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('isolates buckets per user', async () => {
    await consumeQuota('user-1', { perUserPerDay: 1 });
    const a = await consumeQuota('user-1', { perUserPerDay: 1 });
    const b = await consumeQuota('user-2', { perUserPerDay: 1 });
    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(true);
  });

  it('resets when the day rolls over', async () => {
    const day1 = new Date('2026-05-17T23:30:00Z');
    const day2 = new Date('2026-05-18T00:30:00Z');

    await consumeQuota('user-1', { perUserPerDay: 1 }, day1);
    const stillBlocked = await consumeQuota('user-1', { perUserPerDay: 1 }, day1);
    expect(stillBlocked.allowed).toBe(false);

    const fresh = await consumeQuota('user-1', { perUserPerDay: 1 }, day2);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(0);
  });

  it('uses the default cap of 200 when not specified', async () => {
    const r = await consumeQuota('user-1');
    expect(r.limit).toBe(200);
    expect(r.remaining).toBe(199);
  });
});
