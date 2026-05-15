'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Mail, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGmailLogin = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/inbox' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-background to-background flex flex-col lg:flex-row items-center justify-center px-4 gap-12 lg:gap-24">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-200/20 rounded-full blur-3xl" />
      </div>

      {/* Left side - Login form */}
      <div className="relative w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Mavio
          </h1>
          <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
            Understand important emails instantly with explainable AI insights.
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { icon: Sparkles, label: 'AI Summaries' },
            { icon: Zap, label: 'Smart Replies' },
            { icon: Shield, label: 'AI Prioritization' },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium"
            >
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>

        {/* Login card */}
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-md shadow-primary/5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-medium text-foreground">Connect your inbox</h2>
            <p className="text-xs text-muted-foreground">Start with Gmail. Outlook and IMAP coming soon.</p>
          </div>

          <button
            onClick={handleGmailLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:scale-[1.01] hover:shadow-md text-gray-700 font-medium text-sm transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 group"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? 'Connecting…' : 'Continue with Gmail'}
            {!loading && <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-400 group-hover:translate-x-0.5 transition-transform" />}
          </button>

          {/* Outlook/IMAP placeholders (disabled) */}
          <div className="space-y-2 pt-1">
            {['Microsoft Outlook', 'IMAP / Yahoo / AOL'].map((provider) => (
              <div
                key={provider}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground text-sm cursor-not-allowed opacity-50"
              >
                <span>{provider}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">Coming soon</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Your data stays private. We only read emails you interact with.
        </p>
      </div>

      {/* Right side - Product preview */}
      <div className="hidden lg:block w-full max-w-lg">
        <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-lg shadow-primary/5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Explainable priority scoring and actionable AI insights</span>
          </div>
          
          {/* Mock AI panel preview */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-orange-600">URGENT • 92/100</span>
                </div>
                <p className="text-xs text-foreground/80 line-clamp-2">
                  Team proceeds with rollback approach. Key actions: Inform finance and support teams, notify customers by 8 PM.
                </p>
              </div>
            </div>
            
            {/* Mock observability chips */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">Latency: 1.9s</span>
              <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">Tokens: 56</span>
              <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Confidence: High</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground italic">
              "Why it matters: This email involves a rollback approach and customer notification, indicating a significant production issue."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
