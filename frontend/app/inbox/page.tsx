import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { InboxClient } from '@/components/inbox/InboxClient';

export default async function InboxPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <InboxClient
      user={{
        name: session.user?.name ?? '',
        email: session.user?.email ?? '',
        image: session.user?.image ?? '',
      }}
    />
  );
}
