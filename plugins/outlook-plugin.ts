import { OutlookProvider } from '@/lib/providers/outlook';
import { EmailProvider } from '@/lib/providers/interface';

/**
 * OutlookPlugin — wraps OutlookProvider with a consistent plugin metadata
 * surface so the Agent OS plugin registry can list/describe it uniformly
 * alongside GmailPlugin and ImapPlugin.
 *
 * Implementation lives in `lib/providers/outlook.ts` (Microsoft Graph API,
 * per-user OAuth via Azure AD). This file is the public plugin entrypoint.
 */
export class OutlookPlugin extends OutlookProvider implements EmailProvider {
  readonly pluginName = 'OutlookPlugin';
  readonly version = '1.0.0';
  readonly description =
    'Office 365 / Outlook provider using Microsoft Graph API with Azure AD OAuth';
  readonly status = 'implemented' as const;
}

export const outlookPlugin = new OutlookPlugin();
