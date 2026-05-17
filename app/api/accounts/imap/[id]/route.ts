import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

/**
 * PATCH /api/accounts/imap/[id]
 *
 * Reconnect flow: accept a new password, validate against the account's
 * existing imap/smtp host+port, re-encrypt, and clear unhealthy state.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { password } = body || {};
  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 });
  }

  const account = await db.account.findFirst({
    where: { id, userId: session.user.id, provider: 'imap' },
  });

  if (!account) {
    return NextResponse.json({ error: 'IMAP account not found' }, { status: 404 });
  }

  if (
    !account.email ||
    !account.imapHost ||
    !account.imapPort ||
    !account.smtpHost ||
    !account.smtpPort
  ) {
    return NextResponse.json({ error: 'Account is missing IMAP/SMTP config' }, { status: 400 });
  }

  // Validate IMAP login
  const imapClient = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: { user: account.email, pass: password },
    logger: false,
  });
  try {
    await imapClient.connect();
    await imapClient.logout();
  } catch (err: any) {
    return NextResponse.json(
      { error: 'IMAP authentication failed' },
      { status: 401 }
    );
  }

  // Validate SMTP login
  try {
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpPort === 465,
      auth: { user: account.email, pass: password },
    });
    await transporter.verify();
  } catch (err: any) {
    return NextResponse.json(
      { error: 'SMTP authentication failed' },
      { status: 401 }
    );
  }

  const payload = encrypt(password);

  await db.account.update({
    where: { id: account.id },
    data: {
      encryptedPassword: payload.encrypted,
      encryptionIv: payload.iv,
      encryptionTag: payload.tag,
      isHealthy: true,
      lastError: null,
      lastSyncAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
