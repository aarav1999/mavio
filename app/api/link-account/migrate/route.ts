import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const currentUserId = session.user.id;
    const { sourceUserId } = body as { sourceUserId?: string };

    // Determine which user to migrate FROM
    let duplicateUser: { id: string; accounts: any[] } | null = null;

    if (sourceUserId && sourceUserId !== currentUserId) {
      // Prefer explicit source user if provided
      duplicateUser = await db.user.findUnique({
        where: { id: sourceUserId },
        include: { accounts: true },
      });
    } else {
      // Fallback: find the most recently created user (likely the duplicate from the OAuth attempt)
      // among users other than the current one
      const allUsers = await db.user.findMany({
        where: { id: { not: currentUserId } },
        include: { accounts: true },
      });

      duplicateUser = allUsers.sort((a: any, b: any) => {
        // Use ID as a proxy for creation time (cuid is time-ordered)
        return b.id.localeCompare(a.id);
      })[0] ?? null;
    }

    if (!duplicateUser) {
      return NextResponse.json({ error: 'No duplicate user found' }, { status: 404 });
    }

    if (duplicateUser.id === currentUserId) {
      return NextResponse.json({ message: 'No migration needed' });
    }

    // Migrate accounts from duplicate to current user
    await db.account.updateMany({
      where: { userId: duplicateUser.id },
      data: { userId: currentUserId },
    });

    await db.email.updateMany({
      where: { userId: duplicateUser.id },
      data: { userId: currentUserId },
    });

    // Delete duplicate user
    await db.user.delete({ where: { id: duplicateUser.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
