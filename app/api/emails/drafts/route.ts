import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// POST - Create a new draft
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { to, subject, body } = await req.json();

    if (!subject && !body) {
      return NextResponse.json({ error: 'Draft must have subject or body' }, { status: 400 });
    }

    // Get the user's account
    const account = await db.account.findFirst({
      where: { userId: session.user.id, provider: { in: ['google', 'azure-ad', 'imap'] } },
      orderBy: { id: 'desc' },
    });

    if (!account) {
      return NextResponse.json({ error: 'No account found' }, { status: 401 });
    }

    const draft = await db.email.create({
      data: {
        userId: session.user.id,
        accountId: account.id,
        gmailId: undefined,
        outlookId: undefined,
        providerMessageId: undefined,
        threadId: `draft-${Date.now()}`,
        subject: subject || '(No Subject)',
        fromName: account.name || account.email || 'Me',
        fromEmail: account.email || session.user.email || '',
        toEmail: to || '',
        snippet: (body || '').slice(0, 200),
        body: body || '',
        receivedAt: new Date(),
        isRead: true,
        isStarred: false,
        isArchived: false,
        labels: ['DRAFT'],
      },
    });

    return NextResponse.json({ id: draft.id, success: true });
  } catch (err: any) {
    console.error('[drafts/POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH - Update an existing draft
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, to, subject, body } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 });
    }

    // Verify the draft belongs to the user
    const existingDraft = await db.email.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const updatedDraft = await db.email.update({
      where: { id },
      data: {
        subject: subject || '(No Subject)',
        toEmail: to || '',
        snippet: (body || '').slice(0, 200),
        body: body || '',
        receivedAt: new Date(), // Update timestamp
      },
    });

    return NextResponse.json({ id: updatedDraft.id, success: true });
  } catch (err: any) {
    console.error('[drafts/PATCH]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Delete a draft
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Draft ID is required' }, { status: 400 });
    }

    // Verify the draft belongs to the user
    const existingDraft = await db.email.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    await db.email.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[drafts/DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
