import useSWR, { mutate } from 'swr';

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch accounts');
  }
  const data = await res.json();
  return data.accounts || [];
};

export function useAccounts() {
  const { data: accounts = [], error, isLoading } = useSWR<Account[]>('/api/accounts', fetcher);

  return {
    accounts,
    isLoading,
    error,
    mutate,
  };
}
