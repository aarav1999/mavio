import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: accountId } = await params;

  try {
    // Verify the account belongs to the current user
    const account = await db.account.findFirst({
      where: {
        id: accountId,
        userId: session.user.id,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Delete email records associated with this account
    await db.$executeRaw`DELETE FROM "Email" WHERE "accountId" = ${accountId}`;

    // Delete the account
    await db.account.delete({
      where: { id: accountId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[delete account] Error:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
