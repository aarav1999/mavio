import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/oauth';
import { InboxClient } from '@/components/inbox/InboxClient';

export default async function InboxPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  
  if (!sessionToken) redirect('/login');
  
  const session = await getSession(sessionToken);
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
