'use client';

import { useState } from 'react';
import { Menu, X, Mail, Star, Send, Trash2, Inbox, Tag, PenSquare, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountSwitcher } from './AccountSwitcher';
import { useSignOut } from '@/lib/auth-client';

interface Props {
  user: { name: string; email: string; image: string };
  activeLabel: string;
  onLabelChange: (label: string) => void;
  onCompose: () => void;
}

const navItems = [
  { label: 'INBOX', icon: Inbox, display: 'Inbox' },
  { label: 'STARRED', icon: Star, display: 'Starred' },
  { label: 'SENT', icon: Send, display: 'Sent' },
  { label: 'DRAFT', icon: Mail, display: 'Drafts' },
  { label: 'CATEGORY_PROMOTIONS', icon: Tag, display: 'Promotions' },
  { label: 'TRASH', icon: Trash2, display: 'Trash' },
];

export function MobileNav({ user, activeLabel, onLabelChange, onCompose }: Props) {
  const [open, setOpen] = useState(false);
  const { signOut } = useSignOut();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="relative w-[85vw] max-w-[320px] h-[100dvh] bg-background border-r border-border shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0 bg-background">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-base font-semibold">Mavio</span>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 min-h-0 overflow-y-auto">

              {/* Compose */}
              <div className="p-4 border-b border-border">
                <button
                  onClick={() => {
                    onCompose();
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <PenSquare className="w-4 h-4" />
                  Compose
                </button>
              </div>

              {/* Navigation */}
              <nav className="px-3 py-4 space-y-2">
                {navItems.map(({ label, icon: Icon, display }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onLabelChange(label);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base transition-colors text-left',
                      activeLabel === label
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{display}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Bottom account section */}
            <div className="border-t border-border p-3 bg-background flex-shrink-0">
              <div className="mb-3">
                <AccountSwitcher />
              </div>

              <button
                onClick={() => signOut('/login')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
