export interface ReplyDraft {
  tone: string;
  subject: string;
  body: string;
}

export type ReplyCallback = (reply: ReplyDraft) => Promise<void> | void;

/**
 * Simple hook function called when a reply is generated.
 * No complex event buses or distributed systems - just a simple function.
 * 
 * @param reply - The generated reply draft
 * @param callback - Function to execute when reply is generated
 */
export async function onReplyGenerated(reply: ReplyDraft, callback?: ReplyCallback): Promise<void> {
  console.log('[Hook] Reply generated:', reply.tone, reply.subject);
  
  if (callback) {
    await callback(reply);
  }
  
  // Default behavior: update UI with reply draft
  // In production, this would update the compose modal or reply panel
}
