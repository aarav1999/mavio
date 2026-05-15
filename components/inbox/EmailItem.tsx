'use client';

import { EmailWithAI } from '@/types/email';
import { formatDistanceToNow } from 'date-fns';
import { Star, Archive, Trash2 } from 'lucide-react';
import { PriorityBadge } from '@/components/ai/PriorityBadge';
import { ActionChips } from '@/components/ai/ActionChips';
import { cn, decodeHtml } from '@/lib/utils';

interface Props {
  email: EmailWithAI;
  selected: boolean;
  onClick: () => void;
  onAction: (action: string, emailId: string, messageId: string) => void;
}

export function EmailItem({ email, selected, onClick, onAction }: Props) {
  const timeAgo = formatDistanceToNow(new Date(email.receivedAt), { addSuffix: false });

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/50 hover:bg-muted/40',
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
        {/* Row 1: name + time */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-sm truncate', !email.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
            {email.fromName || email.fromEmail}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {email.aiPriorityLabel && email.aiPriorityLabel !== 'normal' && (
              <PriorityBadge label={email.aiPriorityLabel} score={email.aiPriorityScore} />
            )}
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
          </div>
        </div>

        {/* Row 2: subject */}
        <p className={cn('text-sm truncate', !email.isRead ? 'font-medium text-foreground' : 'text-foreground/70')}>
          {decodeHtml(email.subject)}
        </p>

        {/* Row 3: AI summary or snippet */}
        <p className="text-xs text-muted-foreground truncate leading-relaxed">
          {email.aiSummary ? decodeHtml(email.aiSummary) : decodeHtml(email.snippet ?? '')}
        </p>

        {/* Row 4: AI action chips */}
        {email.aiActions && email.aiActions.length > 0 && (
          <div className="pt-0.5">
            <ActionChips actions={email.aiActions.slice(0, 2)} />
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-border">
        <button
          onClick={(e) => { e.stopPropagation(); onAction(email.isStarred ? 'unstar' : 'star', email.threadId, email.id); }}
          className={cn('p-1 rounded hover:bg-muted transition-colors', email.isStarred && 'text-yellow-500')}
          title={email.isStarred ? 'Unstar' : 'Star'}
        >
          <Star className="w-3.5 h-3.5" fill={email.isStarred ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAction('archive', email.threadId, email.id); }}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Archive"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAction('trash', email.threadId, email.id); }}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
