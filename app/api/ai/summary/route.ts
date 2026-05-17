import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { SummarizerAgent } from '@/agents/summarizer-agent';
import { PrioritizerAgent } from '@/agents/prioritizer-agent';
import { ClassifierAgent } from '@/agents/classifier-agent';
import { extractActions } from '@/skills/extract-actions';
import { db } from '@/lib/db';
import { generateEmailEmbedding } from '@/lib/ai/embeddings';

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const summary = await SummarizerAgent.run(subject ?? '', (body ?? '') + threadContext);

    // Generate priority analysis
    const priorityResult = await PrioritizerAgent.run(subject ?? '', fromEmail ?? '', body ?? subject ?? '');
    console.log('[ai/summary] Priority result:', priorityResult);

    // Generate category classification
    const category = await ClassifierAgent.run(subject ?? '', fromEmail ?? '', body ?? '');
    console.log('[ai/summary] Category:', category);

    // Assess confidence
    const confidence = await PrioritizerAgent.assessConfidence(subject ?? '', body ?? '');
    console.log('[ai/summary] Confidence:', confidence);

    // Generate actions
    const actions = await extractActions(subject ?? '', body ?? '');

    // Generate next steps (simple implementation)
    const nextSteps = 'Review and respond as appropriate.';

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

    // Generate embedding for semantic search
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmailEmbedding(subject ?? '', body ?? '');
    } catch (error) {
      console.error('[ai/summary] Failed to generate embedding:', error);
      // Continue without embedding - semantic search won't work for this email
    }

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
