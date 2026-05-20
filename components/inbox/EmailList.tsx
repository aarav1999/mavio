'use client';

import { EmailWithAI } from '@/types/email';
import { EmailItem } from './EmailItem';
import { EmailSkeleton } from './EmailSkeleton';

interface Props {
  emails: EmailWithAI[];
  loading: boolean;
  selectedId?: string;
  onSelect: (email: EmailWithAI) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onAction: (action: string, emailId: string, messageId: string) => void;
}

export function EmailList({
  emails,
  loading,
  selectedId,
  onSelect,
  onLoadMore,
  hasMore,
  loadingMore,
  onAction,
}: Props) {
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <EmailSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-6">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">No emails</p>
        <p className="text-xs text-muted-foreground mt-1">Your inbox is empty</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {emails.map((email) => (
        <EmailItem
          key={email.id}
          email={email}
          selected={email.id === selectedId}
          onClick={() => onSelect(email)}
          onAction={onAction}
          onArchive={(id) => onAction('archive', id, email.threadId)}
          onDelete={(id) => onAction('trash', id, email.threadId)}
        />
      ))}

      {hasMore && (
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
