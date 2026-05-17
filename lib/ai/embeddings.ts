// Free embedding generation using Hugging Face inference API
// Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions, fast and free)

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      console.error('[Embeddings] API error:', response.status, response.statusText);
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Handle different response formats
    if (Array.isArray(result) && result[0]?.embedding) {
      return result[0].embedding;
    } else if (result.error) {
      throw new Error(result.error);
    } else {
      throw new Error('Unexpected embedding response format');
    }
  } catch (error) {
    console.error('[Embeddings] Generation error:', error);
    throw error;
  }
}

// Generate embedding for email (subject + body truncated)
export async function generateEmailEmbedding(subject: string, body: string): Promise<number[]> {
  const text = `${subject} ${body}`.substring(0, 2000);
  return generateEmbedding(text);
}

// Calculate cosine similarity between two embeddings
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
