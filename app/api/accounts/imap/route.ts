import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { IMAP_PRESETS } from '@/lib/imap-presets';
import { ProviderFactory } from '@/lib/providers/factory';
import { ImapProvider, IMAPEnvelopeThread } from '@/lib/providers/imap';

export const runtime = 'nodejs';

interface CustomImapConfig {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
}

interface CreateBody {
  email: string;
  password: string;
  provider?: string; // preset key ('yahoo'|'aol'|'zoho') or 'custom'
  customConfig?: CustomImapConfig;
}

/**
 * POST /api/accounts/imap
 *
 * Creates an IMAP account on the unified Account model and performs an
 * envelope-only initial sync (fast onboarding; bodies fetched on demand).
 */
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, password, provider, customConfig } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
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

  // Resolve config from preset or customConfig
  let imapHost: string;
  let imapPort: number;
  let smtpHost: string;
  let smtpPort: number;

  if (provider && provider !== 'custom' && IMAP_PRESETS[provider]) {
    const preset = IMAP_PRESETS[provider];
    imapHost = preset.imapHost;
    imapPort = preset.imapPort;
    smtpHost = preset.smtpHost;
    smtpPort = preset.smtpPort;
  } else if (customConfig?.imapHost && customConfig.imapPort && customConfig.smtpHost && customConfig.smtpPort) {
    imapHost = customConfig.imapHost;
    imapPort = Number(customConfig.imapPort);
    smtpHost = customConfig.smtpHost;
    smtpPort = Number(customConfig.smtpPort);
  } else {
    return NextResponse.json(
      { error: 'Provide a known preset or full customConfig (imapHost, imapPort, smtpHost, smtpPort)' },
      { status: 400 }
    );
  }

  // Encrypt password
  let payload;
  try {
    payload = encrypt(password);
  } catch (err: any) {
    console.error('[IMAP create] Encryption failed:', err?.message);
    return NextResponse.json({ error: 'Server encryption is not configured' }, { status: 500 });
  }

  // Create Account row (unified model)
  let account;
  try {
    account = await db.account.create({
      data: {
        userId: session.user.id,
        type: 'imap',
        provider: 'imap',
        // Use host in providerAccountId so the same email on different servers doesn't collide
        providerAccountId: `imap:${imapHost}:${email}`,
        email: normalizedEmail,
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        encryptedPassword: payload.encrypted,
        encryptionIv: payload.iv,
        encryptionTag: payload.tag,
        token_type: 'basic',
        isHealthy: true,
      },
    });
  } catch (err: any) {
    // Unique violation = account already linked
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'This IMAP account is already connected' }, { status: 409 });
    }
    console.error('[IMAP create] DB error:', err);
    return NextResponse.json({ error: 'Failed to create IMAP account' }, { status: 500 });
  }

  // Initial envelope-only sync (bodies fetched on demand)
  let syncedCount = 0;
  let totalThreads = 0;
  let provider_instance: ImapProvider | null = null;

  try {
    provider_instance = ProviderFactory.create(account) as ImapProvider;
    const result = await provider_instance.listThreads('', { maxResults: 20 });
    const enriched: IMAPEnvelopeThread[] = (result as any).enriched ?? [];
    totalThreads = enriched.length;

    if (enriched.length > 0) {
      const rows = enriched.map((e) => ({
        userId: session.user.id,
        accountId: account.id,
        providerMessageId: e.id,
        threadId: e.id,
        subject: e.subject,
        fromName: e.fromName,
        fromEmail: e.fromEmail,
        toEmail: e.toEmail,
        snippet: e.snippet,
        body: '', // fetched on first open
        receivedAt: e.receivedAt,
        isRead: e.isRead,
        isStarred: e.isStarred,
        isArchived: false,
      }));

      const insertResult = await db.email.createMany({
        data: rows,
        skipDuplicates: true,
      });
      syncedCount = insertResult.count;
    }

    await db.account.update({
      where: { id: account.id },
      data: { isHealthy: true, lastSyncAt: new Date(), lastError: null },
    });
  } catch (err: any) {
    const message = err?.message || 'Initial sync failed';
    console.warn('[IMAP create] Initial sync failed:', message);
    // Account is created but unhealthy — user can reconnect.
    await db.account.update({
      where: { id: account.id },
      data: { isHealthy: false, lastError: message, lastSyncAt: new Date() },
    });
  } finally {
    if (provider_instance) {
      await provider_instance.disconnect().catch(() => {});
    }
  }

  return NextResponse.json({
    success: true,
    accountId: account.id,
    syncedCount,
    totalThreads,
    isHealthy: syncedCount > 0 || totalThreads === 0,
  });
}

/**
 * GET /api/accounts/imap — list IMAP accounts for the current user.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accounts = await db.account.findMany({
    where: { userId: session.user.id, provider: 'imap' },
    select: {
      id: true,
      provider: true,
      email: true,
      imapHost: true,
      imapPort: true,
      smtpHost: true,
      smtpPort: true,
      isHealthy: true,
      lastSyncAt: true,
      lastError: true,
    },
    orderBy: { id: 'desc' },
  });

  return NextResponse.json({ accounts });
}

