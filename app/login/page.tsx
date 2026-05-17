'use client';

import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { Mail, Sparkles, Zap, Shield, ArrowRight, X } from 'lucide-react';
import { ProductPreview } from '@/components/auth/ProductPreview';

type Provider = 'google' | 'outlook' | 'imap';

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async (provider: Provider) => {
    try {
      setLoadingProvider(provider);
      if (provider === 'google') {
        await signIn('google');
      } else if (provider === 'outlook') {
        await signIn('azure-ad');
      } else if (provider === 'imap') {
        // IMAP login is handled via a modal in the AccountSwitcher component
        // For now, redirect to inbox where users can add IMAP accounts
        window.location.href = '/inbox';
      }
    } catch (error) {
      console.error('[Login] Authentication failed:', error);
      setLoadingProvider(null);
    }
  };

  const handleContinue = () => {
    setShowProviderModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/30 via-white to-purple-50/20 flex flex-col lg:flex-row items-center justify-center px-4 lg:px-8 py-8 lg:py-12 gap-8 lg:gap-16">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-200/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-200/15 rounded-full blur-3xl" />
      </div>

      {/* Left section - Login form */}
      <div className="relative w-full max-w-md lg:max-w-lg space-y-6 lg:space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 border border-violet-400/20 shadow-lg shadow-violet-500/20">
            <Mail className="w-6 h-6 lg:w-8 lg:h-8 text-white" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900">
            Mavio
          </h1>
          <p className="text-sm lg:text-base text-gray-600 max-w-sm mx-auto leading-relaxed">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-medium shadow-sm"
            >
              <Icon className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>

        {/* Login card */}
        <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/50 p-5 lg:p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-gray-900">Connect your inbox</h2>
            <p className="text-xs text-gray-500">Gmail, Outlook, Yahoo, AOL, and IMAP accounts supported</p>
          </div>

          <div className="space-y-3">
            {/* Single Continue with Mavio button */}
            <button
              onClick={handleContinue}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-medium text-sm transition-all duration-150 shadow-md shadow-violet-500/20 hover:shadow-lg hover:shadow-violet-500/30 group"
            >
              <Mail className="w-4 h-4" />
              Continue with Mavio
              <ArrowRight className="w-3.5 h-3.5 ml-auto group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Choose Gmail, Outlook, or IMAP after continuing
          </p>
        </div>

        <p className="text-center text-xs text-gray-500">
          Your data stays private. We only read emails you interact with.
        </p>
      </div>

      {/* Right section - Product preview */}
      <div className="w-full max-w-md lg:max-w-lg mt-8 lg:mt-0">
        <ProductPreview />
      </div>

      {/* Provider selection modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProviderModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Choose your email provider</h3>
              <button
                onClick={() => setShowProviderModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Gmail */}
              <button
                onClick={() => handleLogin('google')}
                disabled={loadingProvider === 'google'}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md text-gray-700 font-medium text-sm transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                {loadingProvider === 'google' ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {loadingProvider === 'google' ? 'Connecting…' : 'Continue with Gmail'}
                {loadingProvider !== 'google' && <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-400 group-hover:translate-x-0.5 transition-transform" />}
              </button>

              {/* Outlook */}
              <button
                onClick={() => handleLogin('outlook')}
                disabled={loadingProvider === 'outlook'}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md text-gray-700 font-medium text-sm transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                {loadingProvider === 'outlook' ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#0078D4" d="M21.17 3H2.83C1.74 3 1 3.74 1 4.83v14.34C1 20.26 1.74 21 2.83 21h18.34c1.09 0 1.83-.74 1.83-1.83V4.83C23 3.74 22.26 3 21.17 3zM2.83 4.83h18.34v14.34H2.83V4.83z"/>
                    <path fill="#0078D4" d="M12 7.5l-5.5 3.5v7l5.5 3.5 5.5-3.5v-7L12 7.5zm0 2.3l3.5 2.2v4.5L12 18.7l-3.5-3.2v-4.5L12 9.8z"/>
                  </svg>
                )}
                {loadingProvider === 'outlook' ? 'Connecting…' : 'Continue with Outlook'}
                {loadingProvider !== 'outlook' && <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-400 group-hover:translate-x-0.5 transition-transform" />}
              </button>

              {/* IMAP */}
              <button
                onClick={() => handleLogin('imap')}
                disabled={loadingProvider === 'imap'}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md text-gray-700 font-medium text-sm transition-all duration-150 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 group"
              >
                {loadingProvider === 'imap' ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 text-gray-600" />
                )}
                {loadingProvider === 'imap' ? 'Loading…' : 'Add IMAP Account'}
                {loadingProvider !== 'imap' && <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-400 group-hover:translate-x-0.5 transition-transform" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
