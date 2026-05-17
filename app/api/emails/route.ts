import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';
import { ProviderFactory } from '@/lib/providers/factory';
import { OutlookProvider } from '@/lib/providers/outlook';
import { gmailPlugin } from '@/plugins/gmail-plugin';
import { parseEmailHeaders } from '@/skills/parse-email';
import { getValidAccessToken } from '@/lib/oauth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageToken = searchParams.get('pageToken') ?? undefined;
  const q = searchParams.get('q') ?? undefined;
  const maxResults = parseInt(searchParams.get('maxResults') ?? '20');
  const accountIdFilter = searchParams.get('accountId') ?? undefined; // Optional: filter by specific account

  // Check if requesting SENT or DRAFT labels - fetch from Gmail folders
  const isSentLabel = q === 'label:sent';
  const isDraftLabel = q === 'label:draft';
  const isTrashLabel = q === 'label:trash';
  const isStarredLabel = q === 'label:starred';

  // For SENT, DRAFT, TRASH, and STARRED, fetch from provider APIs and sync to DB
  if (isSentLabel || isDraftLabel || isTrashLabel || isStarredLabel) {
    // Get all accounts (Gmail, Outlook, IMAP)
    const allAccounts = await db.account.findMany({
      where: { userId: session.user.id, provider: { in: ['google', 'azure-ad', 'imap'] } },
      orderBy: { id: 'desc' },
    });

    if (allAccounts.length === 0) {
      return NextResponse.json({ emails: [], nextPageToken: null });
    }

    // Filter by account if specified
    const accountsToFetch = accountIdFilter 
      ? allAccounts.filter(a => a.id === accountIdFilter)
      : allAccounts;

    if (accountsToFetch.length === 0) {
      return NextResponse.json({ emails: [], nextPageToken: null });
    }

    let allEmails: any[] = [];

    // Fetch from each provider
    await Promise.all(accountsToFetch.map(async (account) => {
      try {
        if (account.provider === 'google') {
          if (!account.access_token) return;

          const gmailLabelId = isSentLabel ? 'SENT' : isDraftLabel ? 'DRAFT' : isTrashLabel ? 'TRASH' : 'STARRED';
          const { listThreads, getThread, parseEmailHeaders, modifyEmail, getGmailClient } = await import('@/lib/gmail/client');
          const gmail = getGmailClient(account.access_token!);

          if (isTrashLabel) {
            const whereClause: any = {
              userId: session.user.id,
              accountId: account.id,
              isArchived: true,
            };

            const gmailEmails = await db.email.findMany({
              where: whereClause,
              orderBy: { receivedAt: 'desc' },
              take: maxResults,
            });

            const decoratedEmails = gmailEmails.map(e => ({
              ...e,
              accountId: account.id,
              provider: 'google',
              accountEmail: account.email,
            }));

            allEmails = [...allEmails, ...decoratedEmails];
            return;
          }

          const result = await listThreads(account.access_token, {
            maxResults,
            labelIds: [gmailLabelId],
          });

          const threads = result.threads || [];

          const accountEmails = await Promise.all(
            threads.slice(0, maxResults).map(async (t: any) => {
              try {
                const threadId = t.id;
                if (!threadId) return null;
                // @ts-ignore - TypeScript null check is too strict, runtime check is sufficient
                const thread = await getThread(account.access_token, threadId);
                const firstMsg = thread.messages?.[0];
                if (!firstMsg || !firstMsg.id) return null;

                const parsed = parseEmailHeaders(firstMsg);

                const upsertData = {
                  userId: session.user.id,
                  accountId: account.id,
                  gmailId: parsed.id,
                  outlookId: undefined,
                  threadId: parsed.threadId || parsed.id,
                  subject: parsed.subject || '',
                  fromName: parsed.fromName || '',
                  fromEmail: parsed.fromEmail || '',
                  toEmail: parsed.toEmail || '',
                  snippet: parsed.snippet || '',
                  body: parsed.body || '',
                  receivedAt: parsed.receivedAt || new Date(),
                  labels: parsed.labels || [],
                  isRead: parsed.isRead || false,
                  isStarred: parsed.isStarred || false,
                  isArchived: isTrashLabel,
                };

                let email;
                try {
                  email = await db.email.create({ data: upsertData });
                } catch (error) {
                  const existing = await db.email.findFirst({
                    where: { userId: session.user.id, gmailId: parsed.id },
                  });
                  if (existing) {
                    email = await db.email.update({
                      where: { id: existing.id },
                      data: { ...upsertData, isArchived: isTrashLabel },
                    });
                  }
                }

                if (!email) return null;

                return {
                  ...email,
                  accountId: account.id,
                  provider: 'google',
                  accountEmail: account.email,
                };
              } catch (err) {
                console.error('[emails API] Failed to fetch Gmail thread:', err);
                return null;
              }
            })
          );

          allEmails = [...allEmails, ...accountEmails.filter((e): e is any => e !== null)];
        } else if (account.provider === 'azure-ad') {
          // For MVP, use DB-first approach for Trash view
          if (isTrashLabel) {
            const whereClause: any = {
              userId: session.user.id,
              accountId: account.id,
              isArchived: true,
            };

            const outlookEmails = await db.email.findMany({
              where: whereClause,
              orderBy: { receivedAt: 'desc' },
              take: maxResults,
            });

            const decoratedEmails = outlookEmails.map(e => ({
              ...e,
              accountId: account.id,
              provider: 'azure-ad',
              accountEmail: account.email,
            }));

            allEmails = [...allEmails, ...decoratedEmails];
            return;
          }

          if (!account.access_token) return;

          const folderMap: { [key: string]: string } = {
            sent: 'sentItems',
            draft: 'drafts',
            starred: 'inbox',
          };
          const folder = folderMap[isSentLabel ? 'sent' : isDraftLabel ? 'draft' : 'starred'];
          
          if (!folder) return;

          // Make direct API call to Outlook Graph API for specific folder
          const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=id,conversationId,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,flag`;
          
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${account.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.error('[emails API] Outlook API error:', response.status);
            return;
          }

          const data: { value: any[]; '@odata.nextLink'?: string } = await response.json();
          const messages = data.value || [];

          const accountEmails = await Promise.all(
            messages.slice(0, maxResults).map(async (msg: any) => {
              try {
                // For starred, filter by flag status
                if (isStarredLabel && msg.flag?.flagStatus !== 'flagged') return null;

                const upsertData = {
                  userId: session.user.id,
                  accountId: account.id,
                  gmailId: undefined,
                  outlookId: msg.id,
                  threadId: msg.conversationId || msg.id,
                  subject: msg.subject || '',
                  fromName: msg.from?.emailAddress?.name || '',
                  fromEmail: msg.from?.emailAddress?.address || '',
                  toEmail: msg.toRecipients?.map((r: any) => r.emailAddress?.address).join(', ') || '',
                  snippet: msg.bodyPreview || '',
                  body: msg.body?.content || '',
                  receivedAt: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
                  labels: [],
                  isRead: msg.isRead || false,
                  isStarred: msg.flag?.flagStatus === 'flagged' || false,
                  isArchived: isTrashLabel,
                };

                const email = await db.email.upsert({
                  where: {
                    userId_outlookId: {
                      userId: session.user.id,
                      outlookId: msg.id,
                    },
                  },
                  create: upsertData,
                  update: upsertData,
                });

                return {
                  ...email,
                  accountId: account.id,
                  provider: 'azure-ad',
                  accountEmail: account.email,
                };
              } catch (err) {
                console.error('[emails API] Failed to fetch Outlook message:', err);
                return null;
              }
            })
          );

          allEmails = [...allEmails, ...accountEmails.filter((e: any): e is any => e !== null)];
        } else if (account.provider === 'imap') {
          // For MVP, use DB-first approach for Trash view
          if (isTrashLabel) {
            const whereClause: any = {
              userId: session.user.id,
              accountId: account.id,
              isArchived: true,
            };

            const imapEmails = await db.email.findMany({
              where: whereClause,
              orderBy: { receivedAt: 'desc' },
              take: maxResults,
            });

            const decoratedEmails = imapEmails.map(e => ({
              ...e,
              accountId: account.id,
              provider: 'imap',
              accountEmail: account.email,
            }));

            allEmails = [...allEmails, ...decoratedEmails];
            return;
          }

          // For IMAP, fetch from actual IMAP folders for other views
          const imapProvider = ProviderFactory.create(account) as any;
            
          try {
            const folder = isSentLabel ? 'sent' : isDraftLabel ? 'draft' : 'inbox';
            const result = await imapProvider.listThreads('', {
              maxResults,
              folder,
            });

            if (result.enriched && result.enriched.length > 0) {
              const enriched = result.enriched;
              console.log(`[emails API] Successfully fetched ${enriched.length} emails from folder: ${folder}`);

              const accountEmails = await Promise.all(
                enriched.slice(0, maxResults).map(async (msg: any) => {
                  try {
                    // For starred, filter by flag
                    if (isStarredLabel && !msg.isStarred) return null;

                    // Use envelope data directly for performance
                    const upsertData = {
                      userId: session.user.id,
                      accountId: account.id,
                      gmailId: undefined,
                      outlookId: undefined,
                      providerMessageId: msg.id,
                      threadId: msg.id,
                      subject: msg.subject || '',
                      fromName: msg.fromName || '',
                      fromEmail: msg.fromEmail || '',
                      toEmail: msg.toEmail || '',
                      snippet: msg.snippet || '',
                      body: msg.snippet || '',
                      receivedAt: msg.receivedAt || new Date(),
                      labels: isSentLabel ? ['SENT'] : isDraftLabel ? ['DRAFT'] : [],
                      isRead: msg.isRead || false,
                      isStarred: msg.isStarred || false,
                      isArchived: false,
                    };

                    const email = await db.email.upsert({
                      where: {
                        accountId_providerMessageId: {
                          accountId: account.id,
                          providerMessageId: msg.id,
                        },
                      },
                      create: upsertData,
                      update: upsertData,
                    });

                    return {
                      ...email,
                      accountId: account.id,
                      provider: 'imap',
                      accountEmail: account.email,
                    };
                  } catch (err) {
                    console.error('[emails API] Failed to fetch IMAP message:', err);
                    return null;
                  }
                })
              );

              allEmails = [...allEmails, ...accountEmails.filter((e: any): e is any => e !== null)];
            }
          } finally {
            await imapProvider.disconnect().catch(() => {});
          }
        }
      } catch (err) {
        console.error(`[emails API] Failed to fetch from ${account.provider}:`, err);
      }
    }));

    // Sort by received date
    allEmails.sort((a, b) => {
      const dateA = new Date(a.receivedAt).getTime();
      const dateB = new Date(b.receivedAt).getTime();
      return dateB - dateA;
    });

    // Deduplicate emails by ID to prevent React key conflicts
    const uniqueEmails = Array.from(
      new Map(allEmails.map(email => [email.id, email])).values()
    );

    return NextResponse.json({ 
      emails: uniqueEmails.slice(0, maxResults), 
      nextPageToken: null 
    });
  }

  // Get all accounts for the user (Gmail, Outlook, IMAP)
  const accounts = await db.account.findMany({
    where: { 
      userId: session.user.id,
      provider: { in: ['google', 'azure-ad', 'imap'] }
    },
    orderBy: { id: 'desc' },
  });

  if (accounts.length === 0) {
    return NextResponse.json({ error: 'No account found' }, { status: 401 });
  }

  // Filter accounts if accountIdFilter is provided
  const accountsToFetch = accountIdFilter 
    ? accounts.filter(a => a.id === accountIdFilter)
    : accounts;

  if (accountsToFetch.length === 0) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // IMAP accounts are served DB-first (no live fetch in this route).
  const imapAccounts = accountsToFetch.filter(a => a.provider === 'imap');
  const oauthAccounts = accountsToFetch.filter(a => a.provider !== 'imap');

  const outlookProvider = new OutlookProvider();

  try {
    let allEmails: any[] = [];

    // 1) Live fetch from OAuth accounts (Gmail / Outlook) in parallel.
    //    IMAP is DB-first; handled separately below.
    await Promise.all(oauthAccounts.map(async (account) => {
      const provider = account.provider;
      let accountAccessToken = account.access_token;
      
      if (!accountAccessToken) return;

      // Use getValidAccessToken to refresh if expired (for Azure AD)
      if (provider === 'azure-ad') {
        try {
          accountAccessToken = await getValidAccessToken(account);
        } catch (error) {
          console.error('[emails API] Failed to get valid access token for Azure AD account:', error);
          return; // Skip this account if token refresh fails
        }
      }
      
      let threads: any[];
      let accountNextPageToken: string | undefined;

      if (provider === 'google') {
        let labelIds = q ? undefined : ['INBOX'];
        if (q && q.startsWith('label:')) {
          const label = q.replace('label:', '').toUpperCase();
          const labelMap: Record<string, string> = {
            'INBOX': 'INBOX',
            'DRAFT': 'DRAFT',
            'DRAFTS': 'DRAFT',
            'STARRED': 'STARRED',
            'IMPORTANT': 'IMPORTANT',
            'SENT': 'SENT',
            'SPAM': 'SPAM',
            'TRASH': 'TRASH',
            'CATEGORY_PERSONAL': 'CATEGORY_PERSONAL',
            'CATEGORY_SOCIAL': 'CATEGORY_SOCIAL',
            'CATEGORY_PROMOTIONS': 'CATEGORY_PROMOTIONS',
            'CATEGORY_UPDATES': 'CATEGORY_UPDATES',
          };
          const labelId = labelMap[label];
          if (labelId) {
            labelIds = [labelId];
          }
        }

        const result = await gmailPlugin.listThreads(accountAccessToken!, {
          maxResults,
          pageToken,
          q: q && !q.startsWith('label:') ? q : undefined,
          labelIds,
        });
        threads = result.threads;
        accountNextPageToken = result.nextPageToken;
      } else if (provider === 'azure-ad') {
        const result = await outlookProvider.listThreads(accountAccessToken!, {
          maxResults,
          pageToken,
        });
        threads = result.threads;
        accountNextPageToken = result.nextPageToken;
      } else {
        return;
      }

      // Fetch full thread details in parallel
      const accountEmails = await Promise.all(
        threads.slice(0, maxResults).map(async (t: any) => {
          let parsed: any;
          
          if (provider === 'google') {
            const thread = await gmailPlugin.getThread(accountAccessToken!, t.id);
            const firstMsg = thread.messages?.[0];
            if (!firstMsg) return null;
            parsed = parseEmailHeaders(firstMsg);
          } else if (provider === 'azure-ad') {
            const msg = await outlookProvider.getThread(accountAccessToken, t.id);
            parsed = msg;
          }

          if (!parsed) return null;

          // Upsert email with accountId
          const upsertData = {
            userId: session.user.id,
            accountId: account.id, // Track which account fetched this email
            gmailId: provider === 'google' ? parsed.id : undefined,
            outlookId: provider === 'azure-ad' ? parsed.id : undefined,
            threadId: parsed.threadId || parsed.id,
            subject: parsed.subject || '',
            fromName: parsed.fromName || '',
            fromEmail: parsed.fromEmail || '',
            toEmail: parsed.toEmail || '',
            snippet: parsed.snippet || '',
            body: parsed.body || '',
            receivedAt: parsed.receivedAt || new Date(),
            labels: parsed.labels || [],
            isRead: parsed.isRead || false,
            isStarred: parsed.isStarred || false,
            isArchived: false,
          };

          // Use create instead of upsert to avoid foreign key constraint issues
          // If the email already exists, the unique constraint will fail and we'll return null
          let email;
          try {
            email = await db.email.create({
              data: upsertData,
            });
          } catch (error) {
            // Email already exists, try to find and update it
            // Use separate where conditions instead of compound unique constraint
            const whereClause: any = provider === 'google' 
              ? { userId: session.user.id, gmailId: parsed.id }
              : { userId: session.user.id, outlookId: parsed.id };
            
            email = await db.email.findFirst({
              where: whereClause,
            });
            
            if (email) {
              email = await db.email.update({
                where: { id: email.id },
                data: {
                  subject: upsertData.subject,
                  fromName: upsertData.fromName,
                  fromEmail: upsertData.fromEmail,
                  toEmail: upsertData.toEmail,
                  snippet: upsertData.snippet,
                  body: upsertData.body,
                  receivedAt: upsertData.receivedAt,
                  labels: upsertData.labels,
                  isRead: upsertData.isRead,
                  isStarred: upsertData.isStarred,
                },
              });
            }
          }

          if (!email) return null;

          return {
            ...email,
            accountId: account.id,
            provider: account.provider,
          };
        })
      );

      // Filter out nulls and add to allEmails
      allEmails = [...allEmails, ...accountEmails.filter(e => e !== null)];
    }));

    // 2) IMAP — DB-first. Read normalized rows directly; no live IMAP call here.
    if (imapAccounts.length > 0) {
      const imapEmails = await db.email.findMany({
        where: {
          userId: session.user.id,
          accountId: { in: imapAccounts.map(a => a.id) },
          isArchived: false,
        },
        orderBy: { receivedAt: 'desc' },
        take: maxResults,
      });
      const imapById = new Map(imapAccounts.map(a => [a.id, a]));
      const decorated = imapEmails.map(e => ({
        ...e,
        accountId: e.accountId,
        provider: 'imap',
        accountEmail: imapById.get(e.accountId!)?.email,
      }));
      allEmails = [...allEmails, ...decorated];
    }

    // Sort all emails by receivedAt (newest first)
    allEmails.sort((a, b) => {
      const dateA = new Date(a.receivedAt).getTime();
      const dateB = new Date(b.receivedAt).getTime();
      return dateB - dateA;
    });

    // Deduplicate emails by ID to prevent React key conflicts
    const uniqueEmails = Array.from(
      new Map(allEmails.map(email => [email.id, email])).values()
    );

    // Limit results to maxResults
    const finalEmails = uniqueEmails.slice(0, maxResults);

    return NextResponse.json({ 
      emails: finalEmails, 
      nextPageToken: pageToken // Simplified pagination for unified inbox
    });
  } catch (err: any) {
    console.error('[emails API] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to load emails' }, { status: 500 });
  }
}

// Helper function for unique constraint
function userId_gmailId(provider: string, userId: string, id: string) {
  if (provider === 'google') {
    return { userId, gmailId: id };
  }
  return { userId, outlookId: id };
}
