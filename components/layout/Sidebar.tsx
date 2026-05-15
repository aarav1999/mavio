'use client';

import { signOut } from 'next-auth/react';
import { Mail, Star, Send, Archive, Trash2, PenSquare, LogOut, Inbox, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Props {
  user: { name: string; email: string; image: string };
  activeLabel: string;
  onLabelChange: (label: string) => void;
  onCompose: () => void;
}

const navItems = [
  { label: 'INBOX',   icon: Inbox,   display: 'Inbox' },
  { label: 'STARRED', icon: Star,    display: 'Starred' },
  { label: 'SENT',    icon: Send,    display: 'Sent' },
  { label: 'DRAFT',   icon: Mail,    display: 'Drafts' },
  { label: 'CATEGORY_PROMOTIONS', icon: Tag, display: 'Promotions' },
  { label: 'TRASH',   icon: Trash2,  display: 'Trash' },
];

export function Sidebar({ user, activeLabel, onLabelChange, onCompose }: Props) {
  return (
    <aside className="w-56 flex flex-col h-full border-r border-border bg-background">
      {/* Logo */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Mavio</span>
        </div>
      </div>

      {/* Compose button */}
      <div className="px-4 pb-3">
        <button
          onClick={onCompose}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PenSquare className="w-3.5 h-3.5" />
          Compose
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, display }) => (
          <button
            key={label}
            onClick={() => onLabelChange(label)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
              activeLabel === label
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {display}
          </button>
        ))}
      </nav>

      {/* User profile */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors group">
          {user.image ? (
            <Image src={user.image} alt={user.name} width={28} height={28} className="rounded-full flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">
              {user.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-1 rounded hover:bg-muted-foreground/10 transition-all"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
