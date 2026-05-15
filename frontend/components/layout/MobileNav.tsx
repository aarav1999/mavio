'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Menu, X, Mail, Star, Send, Archive, Trash2, Inbox, Tag, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  { label: 'TRASH',   icon: Trash2,  display: 'Trash' },
];

export function MobileNav({ user, activeLabel, onLabelChange, onCompose }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Drawer */}
          <div className="relative w-64 max-w-[80vw] h-full bg-background border-r border-border flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Mavio</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
              {navItems.map(({ label, icon: Icon, display }) => (
                <button
                  key={label}
                  onClick={() => { onLabelChange(label); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors',
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

            <div className="p-3 border-t border-border">
              <div className="px-2 py-1 mb-2">
                <p className="text-xs font-medium truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
