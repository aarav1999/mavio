'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmailWithAI, ReplyDraft } from '@/types/email';
import { EmailList } from '@/components/inbox/EmailList';
import { EmailDetail } from '@/components/inbox/EmailDetail';
import { ComposeModal } from '@/components/compose/ComposeModal';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { SearchBar } from '@/components/inbox/SearchBar';
import { AccountSwitcher } from '@/components/layout/AccountSwitcher';
import { PatternPanel } from '@/components/ai/PatternPanel';
import { FolderSuggestions } from '@/components/ai/FolderSuggestions';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { KeyboardHelp } from '@/components/KeyboardHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAccounts as useSWRAccounts } from '@/lib/hooks/useAccounts';
import { useAccounts } from '@/components/providers/AccountProvider';
import { PenSquare, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  name: string;
  email: string;
  image: string;
}

interface InboxClientProps {
  user: User;
}

export function InboxClient({ user }: InboxClientProps) {
  const [emails, setEmails] = useState<EmailWithAI[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailWithAI | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeDraft, setActiveDraft] = useState<ReplyDraft | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [activeLabel, setActiveLabel] = useState('INBOX');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showPatterns, setShowPatterns] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { activeAccountId } = useAccounts(); // For active account selection
  const { accounts } = useSWRAccounts(); // For account list via SWR

  const fetchEmails = useCallback(async (label = activeLabel, reset = true, accountId = activeAccountId) => {
    if (reset) setLoading(true);
    try {
      let url = label === 'SEARCH' && searchQuery
        ? `/api/emails/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/emails?maxResults=20${label !== 'INBOX' ? `&q=label:${label.toLowerCase()}` : ''}`;
      
      // Add accountId filter if provided (explicitly passed or active account)
      if (accountId) {
        url += `&accountId=${accountId}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (reset) {
        setEmails(data.emails ?? []);
        setNextPageToken(data.nextPageToken);
      } else {
        setEmails((prev) => [...prev, ...(data.emails ?? [])]);
        setNextPageToken(data.nextPageToken);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load emails');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeLabel, searchQuery, activeAccountId]);

  useEffect(() => {
    fetchEmails(activeLabel, true, activeAccountId);
  }, [activeLabel, activeAccountId]);

  // Silent background refresh — doesn't show loading spinner
  const silentRefresh = useCallback(async () => {
    try {
      let url = `/api/emails?maxResults=20${activeLabel !== 'INBOX' ? `&q=label:${activeLabel.toLowerCase()}` : ''}`;
      
      // Add accountId filter if active account is selected
      if (activeAccountId) {
        url += `&accountId=${activeAccountId}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.emails?.length) setEmails(data.emails);
    } catch { /* silent */ }
  }, [activeLabel, activeAccountId]);

  // Poll every 30s for new emails
  useEffect(() => {
    pollRef.current = setInterval(silentRefresh, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [silentRefresh]);

  // Check onboarding status for first-time users
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch('/api/user/onboarding');
        const data = await res.json();
        if (!data.onboardingCompleted) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      }
    };
    checkOnboarding();
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onCompose: () => setComposeOpen(true),
    onArchive: () => {
      if (selectedEmail) handleEmailAction('archive', selectedEmail.id, selectedEmail.id);
    },
    onReply: () => {
      if (selectedEmail) setComposeOpen(true);
    },
    onDelete: () => {
      if (selectedEmail) handleEmailAction('trash', selectedEmail.id, selectedEmail.id);
    },
    onStar: () => {
      if (selectedEmail) {
        const action = selectedEmail.isStarred ? 'unstar' : 'star';
        handleEmailAction(action, selectedEmail.id, selectedEmail.id);
      }
    },
    onSearch: () => {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    },
    onHelp: () => setShowKeyboardHelp(true),
    onPrev: () => {
      const currentIndex = emails.findIndex(e => e.id === selectedEmail?.id);
      if (currentIndex > 0) setSelectedEmail(emails[currentIndex - 1]);
    },
    onNext: () => {
      const currentIndex = emails.findIndex(e => e.id === selectedEmail?.id);
      if (currentIndex < emails.length - 1) setSelectedEmail(emails[currentIndex + 1]);
    },
  });

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setActiveLabel('INBOX');
      return;
    }
    setSearching(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/emails/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setEmails(data.emails ?? []);
      setSelectedEmail(null);
    } catch (err: any) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleEmailAction = async (action: string, emailId: string, messageId: string) => {
    // Optimistic update
    const email = emails.find(e => e.id === emailId);
    if (!email) {
      return;
    }

    try {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Action failed');
      }

      // Optimistically update UI
      if (action === 'trash') {
        setEmails(prev => prev.filter(e => e.id !== emailId));
        setSelectedEmail(null);
      } else if (action === 'archive') {
        setEmails(prev => prev.filter(e => e.id !== emailId));
        setSelectedEmail(null);
      } else if (action === 'markRead') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead: true } : e));
      } else if (action === 'markUnread') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isRead: false } : e));
      } else if (action === 'star') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isStarred: true } : e));
      } else if (action === 'unstar') {
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, isStarred: false } : e));
      }

      toast.success('Action completed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to perform action');
    }
    // Refresh to sync with server (append mode with deduplication)
    fetchEmails(activeLabel, false, activeAccountId);
  };

  const handleLoadMore = () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    fetchEmails(activeLabel, false, activeAccountId);
  };

  const handleAccountRemoved = (accountId: string) => {
    // Optimistically filter out emails from the removed account
    setEmails(prev => prev.filter(email => email.accountId !== accountId));
    // If the selected email belongs to the removed account, deselect it
    if (selectedEmail?.accountId === accountId) {
      setSelectedEmail(null);
    }
  };

  // Generate AI inbox intelligence insights
  const getInboxInsights = () => {
    const unreadCount = emails.filter(e => !e.isRead).length;
    const highPriorityCount = emails.filter(e => e.aiPriorityLabel === 'urgent' || e.aiPriorityLabel === 'important').length;
    const needsReplyCount = emails.filter(e => {
      // Simple heuristic: unread and not from self
      return !e.isRead && e.fromEmail !== user.email;
    }).length;
    
    // Get greeting based on time
    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';

    // Get suggested actions based on priority
    const suggestedActions = emails
      .filter(e => e.aiPriorityLabel === 'urgent' || e.aiPriorityLabel === 'important')
      .slice(0, 3)
      .map(e => ({
        id: e.id,
        subject: e.subject,
        priority: e.aiPriorityLabel,
      }));

    return {
      greeting,
      unreadCount,
      highPriorityCount,
      needsReplyCount,
      suggestedActions,
    };
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          user={user}
          activeLabel={activeLabel}
          onLabelChange={(label) => { setActiveLabel(label); setSelectedEmail(null); setSearchQuery(''); }}
          onCompose={() => setComposeOpen(true)}
          onAccountRemoved={handleAccountRemoved}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="md:hidden">
            <MobileNav
              user={user}
              activeLabel={activeLabel}
              onLabelChange={(label) => { setActiveLabel(label); setSelectedEmail(null); }}
              onCompose={() => setComposeOpen(true)}
            />
          </div>
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} loading={searching} />
          </div>
          <button
            onClick={() => fetchEmails(activeLabel, true, activeAccountId)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setComposeOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <PenSquare className="w-3.5 h-3.5" />
            Compose
          </button>
        </div>

        {/* Two-column layout on tablet+ */}
        <div className="flex flex-1 min-h-0">
          {/* Email list */}
          <div className={`flex flex-col ${selectedEmail ? 'hidden md:flex md:w-[45%]' : 'flex-1'} border-r border-border`}>
            {/* AI Insights Panels */}
            <div className="p-4 space-y-4">
              {showPatterns && (
                <PatternPanel onDismiss={() => setShowPatterns(false)} />
              )}
              {showSuggestions && (
                <FolderSuggestions onDismiss={() => setShowSuggestions(false)} />
              )}
            </div>

            <EmailList
              emails={emails}
              loading={loading}
              selectedId={selectedEmail?.id}
              onSelect={setSelectedEmail}
              onLoadMore={handleLoadMore}
              hasMore={!!nextPageToken}
              loadingMore={loadingMore}
              onAction={handleEmailAction}
            />
          </div>

          {/* Email detail */}
          {selectedEmail ? (
            <div className="flex-1 min-w-0 overflow-auto">
              <EmailDetail
                email={selectedEmail}
                onBack={() => setSelectedEmail(null)}
                onAction={handleEmailAction}
                onReply={(draft) => { setActiveDraft(draft); setComposeOpen(true); }}
                onForward={() => {
                  const subject = selectedEmail.subject.startsWith('Fwd:')
                    ? selectedEmail.subject
                    : `Fwd: ${selectedEmail.subject}`;
                  const quoted = `\n\n---------- Forwarded message ----------\nFrom: ${selectedEmail.fromName} <${selectedEmail.fromEmail}>\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body || selectedEmail.snippet}`;
                  setActiveDraft({ tone: 'forward', subject, body: quoted });
                  setComposeOpen(true);
                }}
              />
            </div>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center p-8">
              <div className="max-w-md w-full space-y-6">
                {(() => {
                  const insights = getInboxInsights();
                  return (
                    <>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-semibold text-foreground">{insights.greeting}, {user.name?.split(' ')[0] || 'User'}</h2>
                        <p className="text-sm text-muted-foreground">Here's what's happening in your inbox</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-foreground">{insights.unreadCount}</div>
                          <div className="text-xs text-muted-foreground">Unread</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-foreground">{insights.highPriorityCount}</div>
                          <div className="text-xs text-muted-foreground">High Priority</div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-foreground">{insights.needsReplyCount}</div>
                          <div className="text-xs text-muted-foreground">Needs Reply</div>
                        </div>
                      </div>

                      {insights.suggestedActions.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-foreground">Suggested actions</h3>
                          <div className="space-y-2">
                            {insights.suggestedActions.map(action => (
                              <button
                                key={action.id}
                                onClick={() => setSelectedEmail(emails.find(e => e.id === action.id) || null)}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                              >
                                <div className={`w-2 h-2 rounded-full ${
                                  action.priority === 'urgent' ? 'bg-red-500' : 'bg-amber-500'
                                }`} />
                                <span className="text-sm text-foreground line-clamp-1">{action.subject}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compose modal */}
      <ComposeModal
        open={composeOpen}
        onClose={(sent) => { setComposeOpen(false); setActiveDraft(undefined); if (sent) silentRefresh(); }}
        replyTo={selectedEmail ?? undefined}
        initialDraft={activeDraft}
      />

      {/* Keyboard help modal */}
      {showKeyboardHelp && (
        <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />
      )}

      {/* Onboarding flow */}
      {showOnboarding && (
        <OnboardingFlow
          onClose={() => setShowOnboarding(false)}
          onComplete={async () => {
            setShowOnboarding(false);
            // Mark onboarding as completed
            try {
              await fetch('/api/user/onboarding', { method: 'POST' });
            } catch (error) {
              console.error('Failed to mark onboarding complete:', error);
            }
          }}
        />
      )}
    </div>
  );
}
