/**
 * Cosine Similarity Utility
 * 
 * Calculate semantic similarity between vectors
 * Used for Phase 4 semantic search
 */

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    throw new Error('Vectors must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find top K most similar vectors
 */
export function findTopKSimilar(
  queryVector: number[],
  candidateVectors: Array<{ id: string; vector: number[]; metadata?: any }>,
  k: number = 10
): Array<{ id: string; score: number; metadata?: any }> {
  const similarities = candidateVectors.map(candidate => ({
    id: candidate.id,
    score: cosineSimilarity(queryVector, candidate.vector),
    metadata: candidate.metadata,
  }));

  // Sort by score descending
  similarities.sort((a, b) => b.score - a.score);

  // Return top K
  return similarities.slice(0, k);
}

export default {
  cosineSimilarity,
  findTopKSimilar,
};
