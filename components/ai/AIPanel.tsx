'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Zap, ArrowRight, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { EmailWithAI, ReplyDraft } from '@/types/email';
import { PriorityBadge } from './PriorityBadge';
import { ActionChips } from './ActionChips';
import { cn } from '@/lib/utils';

interface Props {
  email: EmailWithAI;
  onUseDraft: (draft: ReplyDraft) => void;
}

export function AIPanel({ email, onUseDraft }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [drafts, setDrafts] = useState<ReplyDraft[]>([]);
  const [summaryText, setSummaryText] = useState(email.aiSummary ?? '');
  const [streamingSummary, setStreamingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ latency?: number; estimatedTokens?: number } | null>(null);

  // Reset state when email changes
  useEffect(() => {
    setSummaryText(email.aiSummary ?? '');
    setDrafts([]);
    setSummaryError(null);
    setStreamingSummary(false);
  }, [email.id, email.aiSummary]);

  const streamSummary = async (force = false) => {
    if (summaryText && !streamingSummary && summaryError === null && !force) return;
    setStreamingSummary(true);
    setSummaryText('');
    setSummaryError(null);
    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmailId: email.id,
          subject: email.subject ?? '',
          body: email.body ?? email.snippet ?? '',
          fromEmail: email.fromEmail ?? '',
          threadId: email.threadId,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const msg = data.error ?? '';
        const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('Too Many');
        setSummaryError(isRateLimit ? 'Rate limit reached. Wait ~1 min and try again.' : 'Failed to generate. Try again.');
      } else if (data.summary) {
        setSummaryText(data.summary);
        // Update email object with AI analysis for immediate UI update
        (email as any).aiPriorityLabel = data.priorityLabel;
        (email as any).aiPriorityScore = data.priorityScore;
        (email as any).aiWhyItMatters = data.whyItMatters;
        (email as any).aiUrgency = data.urgency;
        (email as any).aiActions = data.actions;
        (email as any).aiNextSteps = data.nextSteps;
        (email as any).aiCategory = data.category;
        (email as any).aiPriorityScore = data.priorityScore;
        (email as any).aiPriorityFactors = data.factors;
        (email as any).aiConfidence = data.confidence;
        setMetrics(data.metrics);
        // Force re-render
        setExpanded(prev => !prev);
        setTimeout(() => setExpanded(prev => !prev), 0);
      } else {
        setSummaryError('Failed to generate. Try again.');
      }
    } catch (err) {
      console.error('[AIPanel] summary fetch failed:', err);
      setSummaryError('Failed to generate. Try again.');
    } finally {
      setStreamingSummary(false);
    }
  };

  const loadDrafts = async () => {
    if (drafts.length > 0) return;
    setLoadingDrafts(true);
    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: email.subject, threadBody: email.body }),
      });
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } finally {
      setLoadingDrafts(false);
    }
  };

  return (
    <>
      {/* DESKTOP: unchanged, only visible md and above */}
      <div className="hidden md:block">
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">AI Insights</span>
              {email.aiPriorityLabel && email.aiPriorityLabel !== 'normal' && (
                <PriorityBadge label={email.aiPriorityLabel} />
              )}
              {email.aiCategory && (
                <span className={cn(
                  'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
                  email.aiCategory === 'work' ? 'bg-blue-100 text-blue-700' :
                  email.aiCategory === 'personal' ? 'bg-green-100 text-green-700' :
                  email.aiCategory === 'promotions' ? 'bg-orange-100 text-orange-700' :
                  email.aiCategory === 'social' ? 'bg-purple-100 text-purple-700' :
                  email.aiCategory === 'spam' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                )}>
                  {email.aiCategory}
                </span>
              )}
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {expanded && (
            <div className="px-3 pb-3 space-y-4 border-t border-border">
              {/* Summary */}
              <div className="pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</span>
                  {(!summaryText || summaryError !== null) ? (
                    <button
                      onClick={() => streamSummary(false)}
                      disabled={streamingSummary}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                      {streamingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate
                    </button>
                  ) : (
                    <button
                      onClick={() => streamSummary(true)}
                      disabled={streamingSummary}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {streamingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Regenerate
                    </button>
                  )}
                </div>
                {summaryError !== null ? (
                  <p className="text-xs text-destructive">{summaryError}</p>
                ) : streamingSummary ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Generating insights...</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2 bg-muted rounded animate-pulse" />
                      <div className="h-2 bg-muted rounded w-3/4 animate-pulse" />
                    </div>
                  </div>
                ) : summaryText ? (
                  <p className="text-sm text-foreground/80 leading-relaxed">{summaryText}</p>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Click Generate to summarize this email with AI</p>
                )}
              </div>

              {/* Observability panel */}
              {(summaryText || email.aiPriorityScore) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {metrics?.latency && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                      <span className="font-medium">Latency:</span>
                      <span>{(metrics.latency / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                  {metrics?.estimatedTokens && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                      <span className="font-medium">Tokens:</span>
                      <span>{metrics.estimatedTokens}</span>
                    </div>
                  )}
                  {email.aiPriorityScore && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                      <span className="font-medium">Priority Score:</span>
                      <span>{Math.min(email.aiPriorityScore, 100)}/100</span>
                    </div>
                  )}
                  {email.aiConfidence && (
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full font-medium',
                      email.aiConfidence === 'high' ? 'bg-green-100 text-green-700' :
                      email.aiConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    )}>
                      <span>Confidence:</span>
                      <span>{email.aiConfidence}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Why it matters + urgency */}
              {(email.aiWhyItMatters || email.aiUrgency || email.aiPriorityFactors || email.aiConfidence) && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  {email.aiWhyItMatters && (
                    <div className="flex gap-2">
                      <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Why it matters</p>
                        <p className="text-sm text-foreground/80">{email.aiWhyItMatters}</p>
                      </div>
                    </div>
                  )}
                  {email.aiUrgency && (
                    <div className="flex gap-2">
                      <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Urgency</p>
                        <p className="text-sm text-foreground/80">{email.aiUrgency}</p>
                      </div>
                    </div>
                  )}
                  {email.aiPriorityFactors && email.aiPriorityFactors.length > 0 && (
                    <div className="flex gap-2">
                      <Zap className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Priority factors</p>
                        <div className="flex flex-wrap gap-1.5">
                          {email.aiPriorityFactors.map((factor, idx) => (
                            <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {email.aiConfidence && (
                    <div className="flex gap-2">
                      <Zap className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Confidence</p>
                        <span className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-full',
                          email.aiConfidence === 'high' ? 'bg-green-100 text-green-700' :
                          email.aiConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          {email.aiConfidence}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Next steps */}
              {email.aiNextSteps && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested Next Step</span>
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
                    <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-[10px] text-gray-600 font-medium">{email.aiNextSteps}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {email.aiActions && email.aiActions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Items</span>
                  <ActionChips actions={email.aiActions} />
                </div>
              )}

              {/* Reply drafts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Smart Replies</span>
                  {drafts.length === 0 && (
                    <button
                      onClick={loadDrafts}
                      disabled={loadingDrafts}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                    >
                      {loadingDrafts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Generate
                    </button>
                  )}
                </div>
                {drafts.map((draft, i) => (
                  <div key={i} className="group p-3 border border-border rounded-lg hover:border-primary/40 transition-colors cursor-pointer space-y-1"
                    onClick={() => onUseDraft(draft)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wide',
                        draft.tone === 'professional' ? 'text-blue-600' :
                        draft.tone === 'friendly' ? 'text-green-600' : 'text-muted-foreground'
                      )}>
                        {draft.tone}
                      </span>
                      <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">Use this →</span>
                    </div>
                    <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{draft.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE: bottom sheet, only visible below md */}
      <div className="md:hidden">
        {/* Collapsed handle / summary strip */}
        <button
          onClick={() => setMobileExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-background border-t border-border text-sm font-medium"
          aria-expanded={mobileExpanded}
        >
          <span className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {email.aiPriorityLabel ?? 'AI'}
            </span>
            <span className="truncate max-w-[200px] text-muted-foreground">
              {summaryText ? summaryText.slice(0, 60) + (summaryText.length > 60 ? '…' : '') : 'Tap for AI insights'}
            </span>
          </span>
          <span className="text-muted-foreground ml-2 flex-shrink-0">
            {mobileExpanded ? '▾' : '▸'}
          </span>
        </button>

        {/* Expanded content — scrollable, max 60dvh */}
        {mobileExpanded && (
          <div className="overflow-y-auto max-h-[60dvh] border-t border-border bg-background px-4 py-3 flex flex-col gap-4">
            {/* Summary */}
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</span>
                {(!summaryText || summaryError !== null) ? (
                  <button
                    onClick={() => streamSummary(false)}
                    disabled={streamingSummary}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {streamingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate
                  </button>
                ) : (
                  <button
                    onClick={() => streamSummary(true)}
                    disabled={streamingSummary}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {streamingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Regenerate
                  </button>
                )}
              </div>
              {summaryError !== null ? (
                <p className="text-xs text-destructive">{summaryError}</p>
              ) : streamingSummary ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Generating insights...</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 bg-muted rounded animate-pulse" />
                    <div className="h-2 bg-muted rounded w-3/4 animate-pulse" />
                  </div>
                </div>
              ) : summaryText ? (
                <p className="text-sm text-foreground/80 leading-relaxed">{summaryText}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Click Generate to summarize this email with AI</p>
              )}
            </div>

            {/* Observability panel */}
            {(summaryText || email.aiPriorityScore) && (
              <div className="flex flex-wrap gap-2 text-xs">
                {metrics?.latency && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                    <span className="font-medium">Latency:</span>
                    <span>{(metrics.latency / 1000).toFixed(1)}s</span>
                  </div>
                )}
                {metrics?.estimatedTokens && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                    <span className="font-medium">Tokens:</span>
                    <span>{metrics.estimatedTokens}</span>
                  </div>
                )}
                {email.aiPriorityScore && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                    <span className="font-medium">Priority Score:</span>
                    <span>{Math.min(email.aiPriorityScore, 100)}/100</span>
                  </div>
                )}
                {email.aiConfidence && (
                  <div className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full font-medium',
                    email.aiConfidence === 'high' ? 'bg-green-100 text-green-700' :
                    email.aiConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  )}>
                    <span>Confidence:</span>
                    <span>{email.aiConfidence}</span>
                  </div>
                )}
              </div>
            )}

            {/* Why it matters + urgency */}
            {(email.aiWhyItMatters || email.aiUrgency || email.aiPriorityFactors || email.aiConfidence) && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                {email.aiWhyItMatters && (
                  <div className="flex gap-2">
                    <Zap className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Why it matters</p>
                      <p className="text-sm text-foreground/80">{email.aiWhyItMatters}</p>
                    </div>
                  </div>
                )}
                {email.aiUrgency && (
                  <div className="flex gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Urgency</p>
                      <p className="text-sm text-foreground/80">{email.aiUrgency}</p>
                    </div>
                  </div>
                )}
                {email.aiPriorityFactors && email.aiPriorityFactors.length > 0 && (
                  <div className="flex gap-2">
                    <Zap className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Priority factors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {email.aiPriorityFactors.map((factor, idx) => (
                          <span key={idx} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {email.aiConfidence && (
                  <div className="flex gap-2">
                    <Zap className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Confidence</p>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        email.aiConfidence === 'high' ? 'bg-green-100 text-green-700' :
                        email.aiConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      )}>
                        {email.aiConfidence}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Next steps */}
            {email.aiNextSteps && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested Next Step</span>
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg">
                  <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-[10px] text-gray-600 font-medium">{email.aiNextSteps}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            {email.aiActions && email.aiActions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action Items</span>
                <ActionChips actions={email.aiActions} />
              </div>
            )}

            {/* Reply drafts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Smart Replies</span>
                {drafts.length === 0 && (
                  <button
                    onClick={loadDrafts}
                    disabled={loadingDrafts}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {loadingDrafts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate
                  </button>
                )}
              </div>
              {drafts.map((draft, i) => (
                <div key={i} className="group p-3 border border-border rounded-lg hover:border-primary/40 transition-colors cursor-pointer space-y-1"
                  onClick={() => onUseDraft(draft)}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wide',
                      draft.tone === 'professional' ? 'text-blue-600' :
                      draft.tone === 'friendly' ? 'text-green-600' : 'text-muted-foreground'
                    )}>
                      {draft.tone}
                    </span>
                    <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">Use this →</span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{draft.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
