import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listThreads, getThread, parseEmailHeaders } from '@/lib/gmail/client';
import { db } from '@/lib/db';
import { analyzeEmail } from '@/lib/ai/gemini';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get('pageToken') ?? undefined;
  const q = searchParams.get('q') ?? undefined;
  const maxResults = parseInt(searchParams.get('maxResults') ?? '20');

  const accessToken = (session as any).accessToken as string | null;
  if (!accessToken) {
    return NextResponse.json({ error: 'No access token' }, { status: 401 });
  }

  // Handle label filtering from Gmail search query (e.g., label:drafts)
  let labelIds = q ? undefined : ['INBOX'];
  if (q && q.startsWith('label:')) {
    const label = q.replace('label:', '').toUpperCase();
    // Map common Gmail labels to their IDs
    const labelMap: Record<string, string> = {
      'INBOX': 'INBOX',
      'DRAFTS': 'DRAFT',
      'STARRED': 'STARRED',
      'IMPORTANT': 'IMPORTANT',
      'SENT': 'SENT',
      'SPAM': 'SPAM',
      'TRASH': 'TRASH',
      'CATEGORY_PERSONAL': 'CATEGORY_PERSONAL',
      'CATEGORY_SOCIAL': 'CATEGORY_SOCIAL',
      'CATEGORY_PROMOTIONS': 'CATEGORY_PROMOTIONS',
      'CATEGORY_UPDATES': 'CATEGORY_UPDATES',
    };
    const labelId = labelMap[label];
    if (labelId) {
      labelIds = [labelId];
    }
  }

  try {
    // Fetch thread list from Gmail
    const { threads, nextPageToken } = await listThreads(accessToken, {
      maxResults,
      pageToken,
      q: q && !q.startsWith('label:') ? q : undefined,
      labelIds,
    });

    // Fetch full thread details in parallel (limit to 10 at a time)
    const emails = await Promise.all(
      threads.slice(0, maxResults).map(async (t) => {
        const thread = await getThread(accessToken, t.id);
        const firstMsg = thread.messages?.[0];
        if (!firstMsg) return null;
        const parsed = parseEmailHeaders(firstMsg);

        // Upsert to DB for caching
        const existing = await db.email.findUnique({ where: { gmailId: parsed.id } });

        if (!existing) {
          await db.email.upsert({
            where: { gmailId: parsed.id },
            create: {
              userId: session.user!.id!,
              gmailId: parsed.id,
              threadId: parsed.threadId,
              subject: parsed.subject,
              fromName: parsed.fromName,
              fromEmail: parsed.fromEmail,
              toEmail: parsed.toEmail,
              snippet: parsed.snippet,
              body: parsed.body,
              isRead: parsed.isRead,
              isStarred: parsed.isStarred,
              labels: parsed.labels,
              receivedAt: parsed.receivedAt,
            },
            update: {
              isRead: parsed.isRead,
              isStarred: parsed.isStarred,
              labels: parsed.labels,
            },
          });

          // Background AI analysis disabled — triggered on-demand from AIPanel to preserve quota
        }

        return {
          ...parsed,
          aiSummary: existing?.aiSummary ?? null,
          aiPriorityScore: existing?.aiPriorityScore ?? null,
          aiPriorityLabel: existing?.aiPriorityLabel ?? null,
          aiActions: existing?.aiActions ?? null,
          aiUrgency: existing?.aiUrgency ?? null,
          aiWhyItMatters: existing?.aiWhyItMatters ?? null,
          aiNextSteps: existing?.aiNextSteps ?? null,
        };
      })
    );

    return NextResponse.json({
      emails: emails.filter(Boolean),
      nextPageToken,
    });
  } catch (err: any) {
    console.error('[emails/GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function analyzeEmailInBackground(
  gmailId: string,
  subject: string,
  fromEmail: string,
  body: string,
  snippet: string
) {
  try {
    const analysis = await analyzeEmail(subject, fromEmail, body, snippet);
    await db.email.updateMany({
      where: { gmailId },
      data: {
        aiSummary: analysis.summary,
        aiPriorityScore: analysis.priorityScore,
        aiPriorityLabel: analysis.priorityLabel,
        aiActions: analysis.actions as any,
        aiUrgency: analysis.urgency,
        aiWhyItMatters: analysis.whyItMatters,
        aiNextSteps: analysis.nextSteps,
      },
    });
  } catch (err) {
    console.error('[background AI analysis]', err);
  }
}
