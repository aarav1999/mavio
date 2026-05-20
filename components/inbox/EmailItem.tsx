'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { EmailWithAI } from '@/types/email';
import { formatDistanceToNow } from 'date-fns';
import { Star, Archive, Trash2, Mail } from 'lucide-react';
import { PriorityBadge } from '@/components/ai/PriorityBadge';
import { ActionChips } from '@/components/ai/ActionChips';
import { cn, decodeHtml } from '@/lib/utils';

interface Props {
  email: EmailWithAI & { provider?: string; accountId?: string };
  selected: boolean;
  onClick: () => void;
  onAction: (action: string, emailId: string, messageId: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function EmailItem({
  email,
  selected,
  onClick,
  onAction,
  onArchive,
  onDelete,
}: Props) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeAction, setSwipeAction] = useState<'archive' | 'delete' | null>(null);

  const timeAgo = formatDistanceToNow(new Date(email.receivedAt), {
    addSuffix: false,
  });

  const handlers = useSwipeable({
    onSwiping: ({ deltaX }) => {
      const clamped = Math.max(-140, Math.min(140, deltaX));

      setSwipeOffset(clamped);

      setSwipeAction(
        clamped > 30
          ? 'archive'
          : clamped < -30
          ? 'delete'
          : null
      );
    },

    onSwipedRight: ({ deltaX }) => {
      if (deltaX > 70) {
        setSwipeOffset(0);
        setSwipeAction(null);
        onArchive?.(email.id);
      } else {
        setSwipeOffset(0);
        setSwipeAction(null);
      }
    },

    onSwipedLeft: ({ deltaX }) => {
      if (deltaX < -70) {
        setSwipeOffset(0);
        setSwipeAction(null);
        onDelete?.(email.id);
      } else {
        setSwipeOffset(0);
        setSwipeAction(null);
      }
    },

    onSwiped: () => {
      setSwipeOffset(0);
      setSwipeAction(null);
    },

    trackMouse: false,
    trackTouch: true,
    delta: 20,
    preventScrollOnSwipe: true,
  });

  const getProviderIcon = (provider?: string) => {
    switch (provider) {
      case 'google':
        return <Mail className="w-3 h-3 text-red-500" />;

      case 'azure-ad':
        return <Mail className="w-3 h-3 text-blue-500" />;

      default:
        return <Mail className="w-3 h-3 text-gray-500" />;
    }
  };

  const getProviderLabel = (provider?: string) => {
    switch (provider) {
      case 'google':
        return 'Gmail';

      case 'azure-ad':
        return 'Outlook';

      default:
        return provider || 'Email';
    }
  };

  return (
    <div className="relative overflow-hidden md:overflow-visible">

      {/* Archive swipe background */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-start pl-5 gap-2 bg-green-500 w-full md:hidden transition-opacity duration-150"
        style={{
          opacity: swipeAction === 'archive' ? 1 : 0,
        }}
      >
        <Archive className="w-5 h-5 text-white" />

        <span className="text-white text-sm font-medium">
          Archive
        </span>
      </div>

      {/* Delete swipe background */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-red-500 w-[140px] md:hidden transition-opacity duration-150"
        style={{
          opacity: swipeAction === 'delete' ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">
            Delete
          </span>

          <Trash2 className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Swipeable row */}
      <div
        {...handlers}
        className="relative bg-background transition-transform duration-150 ease-out md:transform-none"
        style={{
          transform: `translateX(${swipeOffset}px)`,
        }}
      >
        <div
          onClick={onClick}
          className={cn(
            'group relative flex gap-3 px-4 py-3 md:p-4 cursor-pointer transition-colors border-b border-border/50 hover:bg-muted/40',
            selected && 'bg-primary/5 border-l-2 border-l-primary',
            !email.isRead && 'bg-muted/20'
          )}
        >

          {/* Unread dot */}
          {!email.isRead && (
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
          )}

          {/* Avatar */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold select-none">
              {(email.fromName || email.fromEmail)[0]?.toUpperCase() ?? '?'}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">

            {/* Top row */}
            <div className="flex items-center justify-between gap-2">

              <div className="flex items-center gap-1.5 min-w-0">
                {email.provider && (
                  <div
                    className="flex-shrink-0"
                    title={getProviderLabel(email.provider)}
                  >
                    {getProviderIcon(email.provider)}
                  </div>
                )}

                <span
                  className={cn(
                    'text-sm truncate',
                    !email.isRead
                      ? 'font-semibold text-foreground'
                      : 'font-medium text-foreground/80'
                  )}
                >
                  {email.fromName || email.fromEmail}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">

                {email.aiPriorityLabel &&
                  email.aiPriorityLabel !== 'normal' && (
                    <PriorityBadge
                      label={email.aiPriorityLabel}
                      score={email.aiPriorityScore}
                    />
                  )}

                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo}
                </span>

              </div>
            </div>

            {/* Subject */}
            <p
              className={cn(
                'text-sm truncate md:line-clamp-2',
                !email.isRead
                  ? 'font-medium text-foreground'
                  : 'text-foreground/70'
              )}
            >
              {decodeHtml(email.subject)}
            </p>

            {/* Summary */}
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed hidden md:block">
              {email.aiSummary
                ? decodeHtml(email.aiSummary)
                : decodeHtml(email.snippet ?? '')}
            </p>

            {/* AI Actions */}
            {email.aiActions &&
              email.aiActions.length > 0 && (
                <div className="pt-0.5">
                  <ActionChips
                    actions={email.aiActions.slice(0, 2)}
                  />
                </div>
              )}

          </div>

          {/* Desktop hover actions ONLY */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:group-hover:flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-border">

            <button
              onClick={(e) => {
                e.stopPropagation();

                onAction(
                  email.isStarred ? 'unstar' : 'star',
                  email.id,
                  email.threadId
                );
              }}
              className={cn(
                'p-1 rounded hover:bg-muted transition-colors',
                email.isStarred && 'text-yellow-500'
              )}
              title={email.isStarred ? 'Unstar' : 'Star'}
            >
              <Star
                className="w-3.5 h-3.5"
                fill={email.isStarred ? 'currentColor' : 'none'}
              />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();

                onAction(
                  'archive',
                  email.id,
                  email.threadId
                );
              }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();

                onAction(
                  'trash',
                  email.id,
                  email.threadId
                );
              }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

          </div>

        </div>
      </div>
    </div>
  );
}