import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/oauth';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  
  if (!sessionToken) {
    redirect('/login');
  }
  
  const session = await getSession(sessionToken);
  
  if (session) {
    redirect('/inbox');
  } else {
    redirect('/login');
  }
}
