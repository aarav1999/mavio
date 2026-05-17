import { NextRequest, NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Validate IMAP and SMTP credentials before persisting the account.
 *
 * Body: { email, password, imapHost, imapPort, smtpHost, smtpPort }
 * Always uses the configured smtp host/port (no string replacement).
 */
export async function POST(req: NextRequest) {
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

  const { email, password, imapHost, imapPort, smtpHost, smtpPort } = body || {};

  if (!email || !password || !imapHost || !imapPort || !smtpHost || !smtpPort) {
    return NextResponse.json(
      { error: 'Missing required fields: email, password, imapHost, imapPort, smtpHost, smtpPort' },
      { status: 400 }
    );
  }

  // Normalize email for duplicate check
  const normalizedEmail = email.toLowerCase().trim();

  // Check if account with same email already exists (cross-provider check)
  const existingAccount = await db.account.findFirst({
    where: {
      userId: session.user.id,
      email: normalizedEmail,
    },
  });

  if (existingAccount) {
    return NextResponse.json(
      { error: 'This email account is already connected.' },
      { status: 409 }
    );
  }

  // 1) IMAP auth
  const imapClient = new ImapFlow({
    host: imapHost,
    port: Number(imapPort),
    secure: Number(imapPort) === 993,
    auth: { user: email, pass: password },
    logger: false,
  });

  try {
    await imapClient.connect();
    await imapClient.logout();
  } catch (err: any) {
    console.warn('[IMAP validate] IMAP auth failed:', err?.message);
    return NextResponse.json(
      { error: 'IMAP authentication failed. Check your email, app password, host, and port.' },
      { status: 401 }
    );
  }

  // 2) SMTP auth
  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: { user: email, pass: password },
    });
    await transporter.verify();
  } catch (err: any) {
    console.warn('[IMAP validate] SMTP auth failed:', err?.message);
    return NextResponse.json(
      { error: 'SMTP authentication failed. Check SMTP host and port.' },
      { status: 401 }
    );
  }

  return NextResponse.json({ success: true });
}
