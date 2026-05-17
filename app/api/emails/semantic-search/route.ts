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

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Use pgvector cosine similarity search
    // Note: This uses raw SQL for pgvector operations
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
  } catch (error) {
    console.error('[API] Semantic search error:', error);
    return NextResponse.json(
      { error: 'Failed to perform semantic search' },
      { status: 500 }
    );
  }
}
