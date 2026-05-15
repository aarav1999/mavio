'use client';

import { useState, useEffect } from 'react';
import { X, Send, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { EmailWithAI, ReplyDraft } from '@/types/email';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: (sent?: boolean) => void;
  replyTo?: EmailWithAI;
  initialDraft?: ReplyDraft;
}

export function ComposeModal({ open, onClose, replyTo, initialDraft }: Props) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const isForward = initialDraft?.tone === 'forward';
    if (replyTo && !isForward) {
      setTo(replyTo.fromEmail);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
    }
    if (initialDraft) {
      setBody(initialDraft.body);
      setSubject(initialDraft.subject);
      if (isForward) setTo(''); // user must enter forward recipient
    }
  }, [replyTo, initialDraft, open]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('Please fill in To, Subject, and Body');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          body,
          threadId: replyTo?.threadId,
          inReplyTo: replyTo?.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      toast.success('Email sent!');
      onClose(true);
      setTo(''); setSubject(''); setBody('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md sm:max-w-lg">
      <div className={cn(
        'bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-200',
        minimized ? 'h-12' : 'h-[520px] max-h-[90vh]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
          <span className="text-sm font-medium text-foreground">
            {replyTo ? `Reply: ${replyTo.subject}` : 'New Email'}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setMinimized(!minimized)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
              {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onClose()} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!minimized && (
          <div className="flex flex-col h-[calc(100%-49px)]">
            {/* Fields */}
            <div className="border-b border-border">
              <div className="flex items-center px-4 py-2.5 border-b border-border/50">
                <span className="text-xs text-muted-foreground w-12 flex-shrink-0">To</span>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <div className="flex items-center px-4 py-2.5">
                <span className="text-xs text-muted-foreground w-12 flex-shrink-0">Subject</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>

            {/* Body */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email…"
              className="flex-1 px-4 py-3 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed"
            />

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">{body.length} chars</span>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
