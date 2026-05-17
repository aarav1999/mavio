'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Mail, Plus, LogOut, MoreVertical, Trash2, AlertCircle, Loader2, X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccounts as useSWRAccounts } from '@/lib/hooks/useAccounts';
import { useAccounts } from '@/components/providers/AccountProvider';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AccountSwitcherProps {
  onAccountRemoved?: (accountId: string) => void;
}

export function AccountSwitcher({ onAccountRemoved }: AccountSwitcherProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const { accounts, isLoading, error, mutate } = useSWRAccounts();
  const { activeAccountId, setActiveAccountId } = useAccounts();
  const { session, signOut } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reconnect modal state
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [reconnectAccountId, setReconnectAccountId] = useState<string | null>(null);
  const [reconnectPassword, setReconnectPassword] = useState('');
  const [reconnectError, setReconnectError] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Account removal state
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddAccount = () => {
    setIsOpen(false);
    router.push('/add-account');
  };

  const handleSwitchAccount = (accountId: string) => {
    setActiveAccountId(accountId);
    setIsOpen(false);
  };

  const handleRemoveAccount = async (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();

    // Prevent double-click
    if (removingAccountId === accountId) {
      return;
    }

    setRemovingAccountId(accountId);

    // Optimistic removal: remove from SWR cache immediately
    const previousAccounts = accounts;
    const wasActive = activeAccountId === accountId;

    // Trigger optimistic email filtering in parent component
    if (onAccountRemoved) {
      onAccountRemoved(accountId);
    }

    // Optimistically update SWR cache
    mutate(
      '/api/accounts',
      accounts.filter((a: any) => a.id !== accountId),
      false
    );

    // If the removed account was the active one, switch to unified inbox
    if (wasActive) {
      setActiveAccountId(null);
    }

    setIsOpen(false);

    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
      });

      // Handle 404 gracefully - account already deleted
      if (response.status === 404) {
        toast.success('Account removed');
        return;
      }

      if (response.ok) {
        toast.success('Account removed');
        // Revalidate to get fresh data
        mutate('/api/accounts');
      } else {
        // Rollback: restore account on failure
        mutate('/api/accounts', previousAccounts, false);
        if (wasActive) {
          setActiveAccountId(accountId);
        }
        const errorMessage = await response.text();
        toast.error(`Failed to remove account: ${errorMessage}`);
      }
    } catch (err: any) {
      // Rollback: restore account on error
      mutate('/api/accounts', previousAccounts, false);
      if (wasActive) {
        setActiveAccountId(accountId);
      }
      toast.error('Failed to remove account');
    } finally {
      setRemovingAccountId(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  const openReconnectModal = (accountId: string) => {
    setReconnectAccountId(accountId);
    setReconnectPassword('');
    setReconnectError('');
    setShowReconnectModal(true);
    setIsOpen(false);
  };

  const closeReconnectModal = () => {
    setShowReconnectModal(false);
    setReconnectAccountId(null);
    setReconnectPassword('');
    setReconnectError('');
  };

  const handleReconnect = async () => {
    if (!reconnectAccountId || !reconnectPassword) {
      setReconnectError('Password is required');
      return;
    }

    setIsReconnecting(true);
    setReconnectError('');

    try {
      const response = await fetch(`/api/accounts/imap/${reconnectAccountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: reconnectPassword }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data.error || 'Failed to reconnect account';
        setReconnectError(msg);
        toast.error(msg);
        return;
      }

      toast.success('Account reconnected successfully');
      closeReconnectModal();
      router.refresh();
    } catch (err: any) {
      const msg = err?.message || 'Unexpected error';
      setReconnectError(msg);
      toast.error(msg);
    } finally {
      setIsReconnecting(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return <Mail className="w-4 h-4 text-red-500" />;
      case 'azure-ad':
        return <Mail className="w-4 h-4 text-blue-500" />;
      default:
        return <Mail className="w-4 h-4 text-gray-500" />;
    }
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case 'google': return 'Gmail';
      case 'azure-ad': return 'Outlook';
      case 'imap': return 'IMAP';
      default: return provider;
    }
  };

  const getDisplayName = (account: any) => {
    // Use name first, then format email username, then provider label as fallback
    if (account.name) {
      return account.name;
    }
    if (account.email) {
      const username = account.email.split('@')[0];
      // Format raw usernames (e.g., "aaravsingh453" -> "Aarav Singh")
      return formatDisplayName(username);
    }
    return `${getProviderLabel(account.provider)} Account`;
  };

  const formatDisplayName = (username: string): string => {
    // Remove trailing digits
    let formatted = username.replace(/\d+$/, '');
    
    // Split on dots, underscores, or camelCase
    const words = formatted
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to space
      .replace(/[._]/g, ' ') // dots/underscores to space
      .split(' ')
      .filter(w => w.length > 0);
    
    if (words.length === 0) return username;
    
    // Capitalize each word
    const capitalized = words.map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    
    return capitalized.join(' ');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'from-violet-500 to-purple-600',
      'from-blue-500 to-cyan-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-rose-600',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (!session?.user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
          {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 text-left hidden sm:block">
          <p className="text-xs font-medium text-foreground">{session.user.name || 'User'}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {accounts.length > 0 ? `${accounts.length} account${accounts.length > 1 ? 's' : ''}` : 'No accounts'}
          </p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-background border border-border rounded-xl shadow-xl z-[100] overflow-hidden">
          <div className="p-2 space-y-1">
            {/* Unified Inbox Option */}
            <button
              onClick={() => {
                setActiveAccountId(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                !activeAccountId
                  ? 'bg-violet-50 border border-violet-200 text-violet-900'
                  : 'hover:bg-accent/60'
              )}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">Unified Inbox</p>
                <p className="text-xs text-muted-foreground">{accounts.length} connected account{accounts.length !== 1 ? 's' : ''}</p>
              </div>
              {!activeAccountId && (
                <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
              )}
            </button>

            {/* Individual Accounts */}
            {accounts.map((account) => {
              const isIMAP = account.provider === 'imap';
              const isUnhealthy = isIMAP && account.isHealthy === false;
              const isSyncing = account.isSyncing === true;

              return (
                <div
                  key={account.id}
                  className="group relative"
                >
                  <button
                    onClick={() => handleSwitchAccount(account.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 min-w-0',
                      activeAccountId === account.id
                        ? 'bg-violet-50 border border-violet-200'
                        : 'hover:bg-accent/60'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-xs font-semibold shrink-0',
                      getAvatarColor(getDisplayName(account))
                    )}>
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        getInitials(getDisplayName(account))
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{getDisplayName(account)}</p>
                        {isSyncing && (
                          <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                        )}
                        {isUnhealthy && (
                          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={account.email || ''}>
                        {isSyncing ? 'Syncing...' : account.email}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium shrink-0 px-2 py-0.5 bg-muted rounded-full">
                      {getProviderLabel(account.provider)}
                    </span>
                    {activeAccountId === account.id && (
                      <div className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                    )}
                  </button>
                  {isUnhealthy && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openReconnectModal(account.id);
                      }}
                      className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-blue-500 hover:bg-blue-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                      title="Reconnect this account"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 rotate-[-45deg]" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleRemoveAccount(e, account.id)}
                    disabled={removingAccountId === account.id}
                    className={cn(
                      'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0',
                      removingAccountId === account.id
                        ? 'text-muted-foreground cursor-not-allowed'
                        : 'text-muted-foreground hover:bg-red-500/10 hover:text-red-500'
                    )}
                    title="Removes this account from your unified inbox."
                  >
                    {removingAccountId === account.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}

            <div className="border-t border-border my-2" />

            {/* Add Account */}
            <button
              onClick={handleAddAccount}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-accent/60 transition-all duration-150"
            >
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-muted-foreground" />
              </div>
              Add Account
            </button>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-all duration-150"
              title="Connected accounts remain linked until removed."
            >
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              Sign out of app
            </button>
          </div>
        </div>
      )}

      {/* Reconnect Modal */}
      {showReconnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Reconnect IMAP Account</h2>
              <button
                onClick={closeReconnectModal}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your password to reconnect this IMAP account. Your credentials will be encrypted and stored securely.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={reconnectPassword}
                  onChange={(e) => setReconnectPassword(e.target.value)}
                  placeholder="Your password or app password"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {reconnectError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{reconnectError}</p>
                </div>
              )}

              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isReconnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  'Reconnect Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
