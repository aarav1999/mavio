import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateSummary, analyzePriority, extractActions, suggestNextSteps, classifyEmailCategory, assessConfidence } from '@/lib/ai/gemini';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as any)?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { gmailId, subject, body, fromEmail, force, threadId } = await req.json();

  // Check cache first (unless force is true)
  if (gmailId && !force) {
    const cached = await db.email.findFirst({ where: { gmailId } });
    if (cached?.aiSummary) {
      return NextResponse.json({ summary: cached.aiSummary, cached: true });
    }
  }

  try {
    // Fetch thread history for context (disabled temporarily due to stability issues)
    let threadContext = '';
    // if (threadId) {
    //   const threadEmails = await db.email.findMany({
    //     where: { threadId, gmailId: { not: gmailId } },
    //     orderBy: { receivedAt: 'asc' },
    //     take: 5, // Last 5 emails in thread
    //   });
    //   if (threadEmails.length > 0) {
    //     threadContext = '\n\nPrevious emails in this thread:\n' + threadEmails.map(e => 
    //       `From: ${e.fromEmail}\nSubject: ${e.subject}\nBody: ${e.body?.slice(0, 500) || e.snippet || ''}`
    //     ).join('\n---\n');
    //   }
    // }

    const startTime = Date.now();
    const summary = await generateSummary(subject ?? '', (body ?? '') + threadContext);

    // Generate priority analysis
    const priorityResult = await analyzePriority(subject ?? '', fromEmail ?? '', body ?? subject ?? '');
    console.log('[ai/summary] Priority result:', priorityResult);

    // Generate category classification
    const category = await classifyEmailCategory(subject ?? '', fromEmail ?? '', body ?? '');
    console.log('[ai/summary] Category:', category);

    // Assess confidence
    const confidence = await assessConfidence(subject ?? '', body ?? '');
    console.log('[ai/summary] Confidence:', confidence);

    // Generate actions
    const actions = await extractActions(subject ?? '', body ?? '');

    // Generate next steps
    const nextSteps = await suggestNextSteps(subject ?? '', body ?? '');

    const latency = Date.now() - startTime;
    const estimatedTokens = Math.ceil((subject.length + (body || '').length) / 4);

    const responseData = {
      summary,
      priorityLabel: priorityResult.label,
      priorityScore: priorityResult.score,
      whyItMatters: priorityResult.whyItMatters,
      urgency: priorityResult.urgency,
      actions,
      nextSteps,
      category,
      factors: priorityResult.factors,
      confidence,
      metrics: {
        latency,
        estimatedTokens,
      },
    };

    // Cache result
    if (gmailId) {
      await db.email.updateMany({
        where: { gmailId },
        data: {
          aiSummary: summary,
          aiPriorityLabel: priorityResult.label,
          aiPriorityScore: priorityResult.score,
          aiWhyItMatters: priorityResult.whyItMatters,
          aiUrgency: priorityResult.urgency,
          aiActions: actions as any,
          aiNextSteps: nextSteps,
          aiCategory: category,
          aiPriorityFactors: priorityResult.factors as any,
          aiConfidence: confidence,
        },
      });
    }

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error('[ai/summary]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
