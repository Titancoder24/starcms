/**
 * Cosine similarity between two embedding vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

let pipeline: ((texts: string[]) => Promise<{ data: number[][] }>) | null = null;

export async function computeEmbedding(text: string): Promise<number[]> {
  if (!pipeline) {
    // Lazy-load the transformer pipeline
    const { pipeline: createPipeline } = await import(
      "@xenova/transformers"
    );
    const p = await createPipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    pipeline = async (texts: string[]) => {
      const result = await p(texts, { pooling: "mean", normalize: true });
      return { data: Array.from(result.data) as number[][] };
    };
  }
  const truncated = text.slice(0, 2000);
  try {
    const result = await pipeline([truncated]);
    const raw = result.data[0];
    return Array.isArray(raw) ? (raw as number[]) : [];
  } catch {
    return [];
  }
}
