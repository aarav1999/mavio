import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/oauth';
import { db } from '@/lib/db';
import { generateEmbedding } from '@/lib/ai/embeddings';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, limit = 20 } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Try semantic search with pgvector
    try {
      const queryEmbedding = await generateEmbedding(query);

      const results = await db.$queryRaw`
        SELECT 
          id,
          "gmailId",
          "threadId",
          subject,
          "fromName",
          "fromEmail",
          "toEmail",
          snippet,
          "receivedAt",
          "isRead",
          "isStarred",
          "aiSummary",
          "aiPriorityScore",
          "aiPriorityLabel",
          1 - ("aiEmbedding" <=> ${queryEmbedding}::vector) as similarity
        FROM "Email"
        WHERE 
          "userId" = ${session.user.id}
          AND "aiEmbedding" IS NOT NULL
          AND "isArchived" = false
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      return NextResponse.json({ 
        results,
        query,
        method: 'semantic'
      });
    } catch (semanticError) {
      // Fallback to keyword search if pgvector column is unavailable
      console.warn('[API] Semantic search unavailable, falling back to keyword search:', semanticError);
      
      const results = await db.$queryRaw`
        SELECT 
          id,
          "gmailId",
          "threadId",
          subject,
          "fromName",
          "fromEmail",
          "toEmail",
          snippet,
          "receivedAt",
          "isRead",
          "isStarred",
          "aiSummary",
          "aiPriorityScore",
          "aiPriorityLabel
        FROM "Email"
        WHERE 
          "userId" = ${session.user.id}
          AND "isArchived" = false
          AND (
            LOWER(subject) LIKE ${'%' + query.toLowerCase() + '%'}
            OR LOWER("fromName") LIKE ${'%' + query.toLowerCase() + '%'}
            OR LOWER("fromEmail") LIKE ${'%' + query.toLowerCase() + '%'}
            OR LOWER(snippet) LIKE ${'%' + query.toLowerCase() + '%'}
          )
        ORDER BY "receivedAt" DESC
        LIMIT ${limit}
      `;

      return NextResponse.json({ 
        results,
        query,
        method: 'fallback-keyword'
      });
    }
  } catch (error) {
    console.error('[API] Semantic search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
