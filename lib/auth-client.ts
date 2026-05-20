'use client';

import { useAuth } from './auth-context';

export function useSignOut() {
  const { signOut } = useAuth();
  
  return {
    signOut: (redirectUrl?: string) => {
      if (redirectUrl) {
        // Override the default redirect in auth-context
        signOut().then(() => {
          if (redirectUrl) {
            window.location.href = redirectUrl;
          }
        });
      } else {
        signOut();
      }
    }
  };
}
