export interface Email {
  id: string;
  subject: string;
  fromEmail: string;
  body: string;
  snippet: string;
  receivedAt: Date;
}

export type EmailCallback = (email: Email) => Promise<void> | void;

/**
 * Simple hook function called when an email is received.
 * No complex event buses or distributed systems - just a simple function.
 * 
 * @param email - The email that was received
 * @param callback - Function to execute when email is received
 */
export async function onEmailReceived(email: Email, callback?: EmailCallback): Promise<void> {
  if (callback) {
    await callback(email);
  }
  
  // Default behavior: log email receipt
  // In production, this could trigger AI analysis, notifications, etc.
}
