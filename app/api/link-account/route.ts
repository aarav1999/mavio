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
    const { provider, providerAccountId, accountData } = body;

    if (!provider || !providerAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if account already exists
    const existingAccount = await db.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });

    if (existingAccount) {
      // If account belongs to a different user, migrate it
      if (existingAccount.userId !== session.user.id) {
        await db.account.update({
          where: { id: existingAccount.id },
          data: { userId: session.user.id },
        });

        // Delete old user if they have no other accounts
        const oldUserAccounts = await db.account.count({
          where: { userId: existingAccount.userId },
        });
        if (oldUserAccounts === 0) {
          await db.user.delete({ where: { id: existingAccount.userId } }).catch(() => {});
        }
      }
    } else if (accountData) {
      // Create new account linked to current user
      await db.account.create({
        data: {
          ...accountData,
          userId: session.user.id,
        },
      });
    }

    const currentUserId = session.user.id;
    return NextResponse.json({ success: true, userId: currentUserId });
  } catch (error) {
    return NextResponse.json({ error: 'Link account failed' }, { status: 500 });
  }
}
