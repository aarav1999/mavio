'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EmailWithAI, ReplyDraft } from '@/types/email';
import { EmailList } from '@/components/inbox/EmailList';
import { EmailDetail } from '@/components/inbox/EmailDetail';
import { ComposeModal } from '@/components/compose/ComposeModal';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { SearchBar } from '@/components/inbox/SearchBar';
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmails = useCallback(async (label = activeLabel, reset = true) => {
    if (reset) setLoading(true);
    try {
      const url = label === 'SEARCH' && searchQuery
        ? `/api/emails/search?q=${encodeURIComponent(searchQuery)}`
        : `/api/emails?maxResults=20${label !== 'INBOX' ? `&q=label:${label.toLowerCase()}` : ''}`;

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
  }, [activeLabel, searchQuery]);

  useEffect(() => {
    fetchEmails(activeLabel, true);
  }, [activeLabel]);

  // Silent background refresh — doesn't show loading spinner
  const silentRefresh = useCallback(async () => {
    try {
      const url = `/api/emails?maxResults=20${activeLabel !== 'INBOX' ? `&q=label:${activeLabel.toLowerCase()}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.emails?.length) setEmails(data.emails);
    } catch { /* silent */ }
  }, [activeLabel]);

  // Poll every 30s for new emails
  useEffect(() => {
    pollRef.current = setInterval(silentRefresh, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [silentRefresh]);

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
    setEmails((prev) => prev.map((e) => {
      if (e.id !== messageId) return e;
      if (action === 'archive') return { ...e, isArchived: true };
      if (action === 'star') return { ...e, isStarred: true };
      if (action === 'unstar') return { ...e, isStarred: false };
      if (action === 'markRead') return { ...e, isRead: true };
      return e;
    }));

    if (action === 'archive' || action === 'trash') {
      setSelectedEmail(null);
      setEmails((prev) => prev.filter((e) => e.id !== messageId));
    }

    try {
      const res = await fetch(`/api/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageId }),
      });
      if (!res.ok) throw new Error('Action failed');
      toast.success(action === 'archive' ? 'Archived' : action === 'trash' ? 'Deleted' : 'Done');
    } catch {
      toast.error('Action failed, please try again');
      fetchEmails(activeLabel, true);
    }
  };

  const handleLoadMore = () => {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    fetchEmails(activeLabel, false);
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
            onClick={() => fetchEmails(activeLabel, true)}
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
          <div className={`flex flex-col ${selectedEmail ? 'hidden md:flex md:w-80 lg:w-96 xl:w-[420px]' : 'flex-1'} border-r border-border`}>
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
            <div className="hidden md:flex flex-1 items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                  <PenSquare className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Select an email to read</p>
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
    </div>
  );
}
