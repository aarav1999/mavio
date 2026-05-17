import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/accounts - List all accounts for the current user
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accounts = await db.account.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      email: true,
      name: true,
      imapHost: true,
      imapPort: true,
      smtpHost: true,
      smtpPort: true,
      isHealthy: true,
    },
    orderBy: { id: 'desc' },
  });

  return NextResponse.json({ accounts });
}
