export interface AnalysisResult {
  summary: string;
  priorityScore: number;
  priorityLabel: string;
  actions: any[];
  confidence: 'high' | 'medium' | 'low';
}

export type AnalysisCallback = (result: AnalysisResult) => Promise<void> | void;

/**
 * Simple hook function called when AI analysis is complete.
 * No complex event buses or distributed systems - just a simple function.
 * 
 * @param result - The analysis result from AI agents
 * @param callback - Function to execute when analysis completes
 */
export async function onAnalysisComplete(result: AnalysisResult, callback?: AnalysisCallback): Promise<void> {
  if (callback) {
    await callback(result);
  }
  
  // Default behavior: cache result to database
  // In production, this would save to Postgres for instant loading
}
