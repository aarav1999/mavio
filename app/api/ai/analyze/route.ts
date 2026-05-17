import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { processEmail } from '@/lib/orchestrator';
import { db } from '@/lib/db';
import { consumeQuota } from '@/lib/quota-guard';

/**
 * POST /api/ai/analyze
 *
 * Runs the full Agent OS orchestrator (`processEmail`) on a single email row
 * and persists the unified result back to the cache columns. This is the
 * end-to-end multi-agent pipeline that the brief asked for.
 *
 * Request body: { emailId: string }
 *   - emailId: the cuid of an Email row that the caller owns.
 *
 * Response: { result: ProcessedEmail }
 *
 * For incremental / lightweight calls the existing `/api/ai/summary` and
 * `/api/ai/reply` routes remain available.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Per-user daily AI quota — protects the shared Groq key from runaway use.
  const quota = consumeQuota(session.user.id);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: 'Daily AI quota exceeded. Try again tomorrow.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(quota.limit),
          'X-RateLimit-Remaining': '0',
          'Retry-After': String(quota.resetSeconds),
        },
      },
    );
  }

  const { emailId } = await req.json();
  if (!emailId || typeof emailId !== 'string') {
    return NextResponse.json({ error: 'emailId is required' }, { status: 400 });
  }

  const email = await db.email.findFirst({
    where: { id: emailId, userId: session.user.id },
  });
  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  try {
    const result = await processEmail({
      id: email.id,
      subject: email.subject,
      fromEmail: email.fromEmail,
      body: email.body ?? '',
      snippet: email.snippet ?? '',
      receivedAt: email.receivedAt,
    });

    // Persist the unified result back to the cache columns.
    await db.email.update({
      where: { id: email.id },
      data: {
        aiSummary: result.summary,
        aiPriorityScore: result.priority.score,
        aiPriorityLabel: result.priority.label,
        aiWhyItMatters: result.priority.whyItMatters,
        aiUrgency: result.priority.urgency,
        aiPriorityFactors: result.priority.factors as any,
        aiCategory: result.classification,
        aiConfidence: result.confidence,
      },
    });

    return NextResponse.json({ result });
  } catch (err: any) {
    console.error('[ai/analyze]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Analysis failed' },
      { status: 500 },
    );
  }
}
