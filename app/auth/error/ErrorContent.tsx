'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function ErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const error = searchParams.get('error');
  const [isLinking, setIsLinking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (error === 'OAuthAccountNotLinked' && session?.user?.id) {
      // This error occurs when trying to link an account while already signed in
      // We need to manually link the account by deleting the duplicate user
      handleAccountLinking();
    }
  }, [error, session]);

  const handleAccountLinking = async () => {
    setIsLinking(true);
    setMessage('Linking account...');
    
    try {
      // The account was created for a duplicate user
      // We need to find the most recently created user with the same email pattern
      // and migrate their accounts to the current user
      
      const response = await fetch('/api/link-account/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentUserId: session?.user?.id }),
      });

      if (response.ok) {
        setMessage('Account linked successfully!');
        setTimeout(() => {
          router.push('/inbox');
        }, 1000);
      } else {
        setMessage('Failed to link account. Please try again.');
        setIsLinking(false);
      }
    } catch (error) {
      console.error('Error linking account:', error);
      setMessage('An error occurred. Please try again.');
      setIsLinking(false);
    }
  };

  if (error === 'OAuthAccountNotLinked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md p-8 space-y-6">
          <h1 className="text-2xl font-bold">Link Account</h1>
          <p className="text-muted-foreground">
            This account is already linked to another user. We'll link it to your current account instead.
          </p>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
          {!message && (
            <button
              onClick={handleAccountLinking}
              disabled={isLinking}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              {isLinking ? 'Linking...' : 'Link Account'}
            </button>
          )}
          <button
            onClick={() => router.push('/inbox')}
            disabled={isLinking}
            className="w-full px-4 py-2 border border-border rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md p-8 space-y-6">
        <h1 className="text-2xl font-bold">Authentication Error</h1>
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => router.push('/login')}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
