'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface Account {
  id: string;
  provider: string;
  providerAccountId: string;
  email?: string;
  name?: string;
  isHealthy?: boolean;
  imapHost?: string;
  imapPort?: number;
  smtpHost?: string;
  smtpPort?: number;
  isSyncing?: boolean;
}

interface Session {
  user: User;
  accounts: Account[];
}

interface AuthContextType {
  session: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signIn: (provider: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    fetchSession();
    // Also fetch session when window gains focus (e.g., after OAuth redirect)
    const handleFocus = () => fetchSession();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.session?.user) {
        setSession(data.session);
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    } catch (error) {
      console.error('[Auth] Failed to fetch session:', error);
      setSession(null);
      setStatus('unauthenticated');
    }
  };

  const signIn = async (provider: string) => {
    console.log('[Auth] signIn called with provider:', provider);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    const data = await res.json();
    console.log('[Auth] Login API response:', data);
    if (data.authUrl) {
      console.log('[Auth] Redirecting to authUrl:', data.authUrl);
      window.location.href = data.authUrl;
    } else {
      console.error('[Auth] No authUrl in response:', data);
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    setSession(null);
    setStatus('unauthenticated');
    // Clear the cookie on the client side as well
    document.cookie = 'session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    // Clear all localStorage keys to prevent stale state on next login
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ session, status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
