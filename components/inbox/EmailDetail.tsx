'use client';

import { useState, useEffect, useRef } from 'react';
import { EmailWithAI, ReplyDraft } from '@/types/email';
import { format } from 'date-fns';
import { ArrowLeft, Star, Archive, Trash2, Reply, Forward, MoreHorizontal } from 'lucide-react';
import { AIPanel } from '@/components/ai/AIPanel';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Props {
  email: EmailWithAI;
  onBack: () => void;
  onAction: (action: string, emailId: string, messageId: string) => void;
  onReply: (draft?: ReplyDraft) => void;
  onForward: () => void;
}

export function EmailDetail({ email, onBack, onAction, onReply, onForward }: Props) {
  const [showFullBody, setShowFullBody] = useState(false);
  const markedAsReadRef = useRef<string | null>(null);

  // Auto-mark as read when email is opened (only once per email)
  useEffect(() => {
    if (!email.isRead && markedAsReadRef.current !== email.id) {
      markedAsReadRef.current = email.id;
      onAction('markRead', email.threadId, email.id);
    }
  }, [email.id, email.isRead, email.threadId, onAction]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{email.subject}</h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onAction(email.isStarred ? 'unstar' : 'star', email.threadId, email.id)}
            className={cn('p-1.5 rounded-lg hover:bg-muted transition-colors', email.isStarred && 'text-yellow-500')}
          >
            <Star className="w-4 h-4" fill={email.isStarred ? 'currentColor' : 'none'} />
          </button>
          <button onClick={() => onAction('archive', email.threadId, email.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <Archive className="w-4 h-4" />
          </button>
          <button onClick={() => onAction('trash', email.threadId, email.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Subject */}
          <h1 className="text-xl font-semibold text-foreground leading-snug">{email.subject}</h1>

          {/* Sender meta */}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
              {(email.fromName || email.fromEmail)[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{email.fromName || email.fromEmail}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {format(new Date(email.receivedAt), 'MMM d, yyyy · h:mm a')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">To: {email.toEmail}</p>
            </div>
          </div>

          {/* AI Panel */}
          <AIPanel email={email} onUseDraft={(draft) => onReply(draft)} />

          {/* Email body */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div
              className={cn('p-4 transition-all duration-300', !showFullBody && 'max-h-64 overflow-hidden relative')}
            >
              {email.body ? (
                <div
                  className="prose prose-sm max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: email.body }}
                />
              ) : (
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{email.snippet}</p>
              )}
              {!showFullBody && email.body && email.body.length > 500 && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
              )}
            </div>
            {email.body && email.body.length > 500 && (
              <button
                onClick={() => setShowFullBody(!showFullBody)}
                className="w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border hover:bg-muted/40 transition-colors"
              >
                {showFullBody ? 'Show less' : 'Show full email'}
              </button>
            )}
          </div>

          {/* Reply actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onReply()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
            >
              <Reply className="w-3.5 h-3.5" />
              Reply
            </button>
            <button
              onClick={onForward}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
            >
              <Forward className="w-3.5 h-3.5" />
              Forward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
