'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Mail, X, Loader2, HelpCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useAccounts } from '@/lib/hooks/useAccounts';
import { IMAP_PRESETS } from '@/lib/imap-presets';

type Provider = 'google' | 'azure-ad' | 'imap';
type IMAPStep = 'select' | 'credentials' | 'syncing';

export default function AddAccountPage() {
  const router = useRouter();
  const { session, signIn } = useAuth();
  const { accounts, mutate } = useAccounts();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  // IMAP modal state
  const [showIMAPModal, setShowIMAPModal] = useState(false);
  const [imapStep, setImapStep] = useState<IMAPStep>('select');
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState(false);
  const [imapError, setImapError] = useState<string>('');
  const [imapForm, setImapForm] = useState({
    email: '',
    password: '',
    customImapHost: '',
    customImapPort: 993,
    customSmtpHost: '',
    customSmtpPort: 465,
  });

  const handleSignIn = async (provider: 'google' | 'azure-ad') => {
    if (loadingProvider) {
      console.log('[AddAccount] Already linking, ignoring click for:', provider);
      return;
    }
    console.log('[AddAccount] Starting sign in for:', provider);
    try {
      setLoadingProvider(provider);
      await signIn(provider);
    } catch (error) {
      console.error('[AddAccount] Authentication failed:', error);
      setLoadingProvider(null);
    }
  };

  const openIMAPModal = () => {
    setImapStep('select');
    setSelectedPreset('');
    setImapError('');
    setShowIMAPModal(true);
  };

  const closeIMAPModal = () => {
    setShowIMAPModal(false);
    setImapStep('select');
    setSelectedPreset('');
    setImapError('');
  };

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    setImapStep('credentials');
    setImapError('');
  };

  const handleIMAPSubmit = async () => {
    if (!imapForm.email || !imapForm.password) {
      setImapError('Email and password are required');
      return;
    }

    const isCustom = selectedPreset === 'custom';
    const imapHost = isCustom ? imapForm.customImapHost : IMAP_PRESETS[selectedPreset].imapHost;
    const imapPort = isCustom ? imapForm.customImapPort : IMAP_PRESETS[selectedPreset].imapPort;
    const smtpHost = isCustom ? imapForm.customSmtpHost : IMAP_PRESETS[selectedPreset].smtpHost;
    const smtpPort = isCustom ? imapForm.customSmtpPort : IMAP_PRESETS[selectedPreset].smtpPort;

    if (isCustom && (!imapHost || !smtpHost)) {
      setImapError('IMAP host and SMTP host are required for custom config');
      return;
    }

    setLoadingProvider('imap');
    setImapError('');

    try {
      // 1) Validate credentials
      const validateRes = await fetch('/api/accounts/imap/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: imapForm.email,
          password: imapForm.password,
          imapHost,
          imapPort,
          smtpHost,
          smtpPort,
        }),
      });

      console.log('[AddAccount IMAP] Validation response status:', validateRes.status);

      if (!validateRes.ok) {
        const data = await validateRes.json().catch(() => ({}));
        const msg = data.error || 'Connection validation failed';
        console.error('[AddAccount IMAP] Validation failed:', msg);
        setImapError(msg);
        toast.error(msg);
        setImapStep('credentials');
        setLoadingProvider(null);
        return;
      }

      // 2) Create + sync
      setImapStep('syncing');

      // Optimistic insert: add account to SWR cache immediately
      const tempAccountId = `temp-${Date.now()}`;
      const normalizedEmail = imapForm.email.toLowerCase().trim();
      const optimisticAccount = {
        id: tempAccountId,
        provider: 'imap',
        providerAccountId: `imap:${imapHost}:${normalizedEmail}`,
        email: normalizedEmail,
        isHealthy: true,
        imapHost,
        imapPort,
        smtpHost,
        smtpPort,
        isSyncing: true,
      };

      // Optimistically update SWR cache
      mutate('/api/accounts', [...accounts, optimisticAccount], false);

      const createBody: any = {
        email: imapForm.email,
        password: imapForm.password,
      };
      if (isCustom) {
        createBody.customConfig = { imapHost, imapPort, smtpHost, smtpPort };
      } else {
        createBody.provider = selectedPreset;
      }

      const createRes = await fetch('/api/accounts/imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        const msg = data.error || 'Failed to connect account';
        setImapError(msg);
        toast.error(msg);
        setImapStep('credentials');
        setLoadingProvider(null);
        // Remove optimistic account on failure
        mutate('/api/accounts', accounts, false);
        return;
      }

      const data = await createRes.json();
      const realAccountId = data.accountId;

      // Revalidate to get fresh data from server
      mutate('/api/accounts');

      const synced = data.syncedCount ?? 0;
      const total = data.totalThreads ?? 0;
      if (total === 0) {
        toast.success('Account connected (inbox is empty)');
      } else {
        toast.success(`Connected — synced ${synced} of ${total} messages`);
      }

      // Navigate to inbox without forcing refresh
      // Optimistic account will persist in AccountProvider state
      // Session will refresh naturally on window focus
      router.push('/inbox');
    } catch (err: any) {
      console.error('[AddAccount IMAP]', err);
      const msg = err?.message || 'Unexpected error';
      setImapError(msg);
      toast.error(msg);
      setImapStep('credentials');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Add Account</h1>
          <p className="text-sm text-muted-foreground">
            Connect another email account to your unified inbox
          </p>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              Add as many Gmail and Outlook accounts as you like. They will all appear in your unified inbox.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleSignIn('google')}
            disabled={loadingProvider === 'google'}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium">{loadingProvider === 'google' ? 'Signing in...' : 'Continue with Gmail'}</span>
          </button>

          <button
            onClick={() => handleSignIn('azure-ad')}
            disabled={loadingProvider === 'azure-ad'}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#f25022" d="M0 0h11.377v11.372H0z" />
              <path fill="#00a4ef" d="M12.623 0H24v11.372H12.623z" />
              <path fill="#7fba00" d="M0 12.628h11.377V24H0z" />
              <path fill="#ffb900" d="M12.623 12.628H24V24H12.623z" />
            </svg>
            <span className="font-medium">{loadingProvider === 'azure-ad' ? 'Signing in...' : 'Continue with Outlook'}</span>
          </button>

          <button
            onClick={openIMAPModal}
            disabled={loadingProvider === 'imap'}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Mail className="w-5 h-5" />
            <span className="font-medium">{loadingProvider === 'imap' ? 'Connecting...' : 'Add IMAP Account'}</span>
          </button>

          <button
            onClick={() => router.push('/inbox')}
            className="w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* IMAP Modal */}
      {showIMAPModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {imapStep === 'select' && 'Select IMAP Provider'}
                {imapStep === 'credentials' && 'Enter IMAP Credentials'}
                {imapStep === 'syncing' && 'Syncing Account'}
              </h2>
              <button
                onClick={closeIMAPModal}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step: Select Preset */}
            {imapStep === 'select' && (
              <div className="p-4 space-y-3">
                <button
                  onClick={() => handlePresetSelect('gmail')}
                  className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="w-6 h-6 text-red-600" />
                  <div className="text-left">
                    <div className="font-medium">Gmail</div>
                    <div className="text-xs text-muted-foreground">imap.gmail.com</div>
                  </div>
                </button>

                <button
                  onClick={() => handlePresetSelect('yahoo')}
                  className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="w-6 h-6 text-purple-600" />
                  <div className="text-left">
                    <div className="font-medium">Yahoo Mail</div>
                    <div className="text-xs text-muted-foreground">imap.mail.yahoo.com</div>
                  </div>
                </button>

                <button
                  onClick={() => handlePresetSelect('aol')}
                  className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium">AOL Mail</div>
                    <div className="text-xs text-muted-foreground">imap.aol.com</div>
                  </div>
                </button>

                <button
                  onClick={() => handlePresetSelect('zoho')}
                  className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="w-6 h-6 text-red-600" />
                  <div className="text-left">
                    <div className="font-medium">Zoho Mail</div>
                    <div className="text-xs text-muted-foreground">imap.zoho.com</div>
                  </div>
                </button>

                <button
                  onClick={() => handlePresetSelect('custom')}
                  className="w-full flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Mail className="w-6 h-6 text-gray-600" />
                  <div className="text-left">
                    <div className="font-medium">Custom IMAP</div>
                    <div className="text-xs text-muted-foreground">Enter your own server settings</div>
                  </div>
                </button>
              </div>
            )}

            {/* Step: Credentials */}
            {imapStep === 'credentials' && (
              <div className="p-4 space-y-4">
                <button
                  onClick={() => setImapStep('select')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to provider selection
                </button>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <input
                    type="email"
                    value={imapForm.email}
                    onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Password</label>
                    <button
                      onClick={() => setShowAppPasswordHelp(!showAppPasswordHelp)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="password"
                    value={imapForm.password}
                    onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                    placeholder="Your password or app password"
                    className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {showAppPasswordHelp && (
                    <p className="text-xs text-muted-foreground">
                      For Yahoo, AOL, and Zoho, use an app password if regular authentication fails.
                    </p>
                  )}
                </div>

                {selectedPreset === 'custom' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">IMAP Host</label>
                        <input
                          type="text"
                          value={imapForm.customImapHost}
                          onChange={(e) => setImapForm({ ...imapForm, customImapHost: e.target.value })}
                          placeholder="imap.example.com"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">IMAP Port</label>
                        <input
                          type="number"
                          value={imapForm.customImapPort}
                          onChange={(e) => setImapForm({ ...imapForm, customImapPort: parseInt(e.target.value) || 993 })}
                          placeholder="993"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">SMTP Host</label>
                        <input
                          type="text"
                          value={imapForm.customSmtpHost}
                          onChange={(e) => setImapForm({ ...imapForm, customSmtpHost: e.target.value })}
                          placeholder="smtp.example.com"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">SMTP Port</label>
                        <input
                          type="number"
                          value={imapForm.customSmtpPort}
                          onChange={(e) => setImapForm({ ...imapForm, customSmtpPort: parseInt(e.target.value) || 465 })}
                          placeholder="465"
                          className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </>
                )}

                {imapError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{imapError}</p>
                  </div>
                )}

                <button
                  onClick={handleIMAPSubmit}
                  disabled={loadingProvider === 'imap'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loadingProvider === 'imap' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect Account'
                  )}
                </button>
              </div>
            )}

            {/* Step: Syncing */}
            {imapStep === 'syncing' && (
              <div className="p-8 text-center space-y-4">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">Syncing your emails</h3>
                  <p className="text-sm text-muted-foreground">
                    Fetching your latest messages. This may take a moment...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
