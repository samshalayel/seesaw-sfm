/**
 * embeddings.ts
 * HuggingFace Inference API — sentence-transformers/all-MiniLM-L6-v2
 * يحوّل النصوص إلى متجهات (384 بُعد) ويستخدمها للبحث الدلالي (RAG).
 */

const HF_EMBED_URL =
  "https://router.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2";

// ── Embed ─────────────────────────────────────────────────────────────────────

/**
 * يُرجع مصفوفة من المتجهات بنفس ترتيب النصوص.
 * كل متجه = مصفوفة float بطول 384.
 */
export async function embedTexts(
  texts: string[],
  hfToken: string
): Promise<number[][]> {
  if (!texts.length) return [];

  const res = await fetch(HF_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: texts }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`HuggingFace embed error ${res.status}: ${msg}`);
  }

  const data = await res.json();
  // يرجع: number[][] مباشرة لأكثر من نص، أو number[] لنص واحد
  if (Array.isArray(data[0])) return data as number[][];
  return [data as number[]];
}

// ── Cosine Similarity ─────────────────────────────────────────────────────────

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * يقسّم النص الطويل إلى قطع متداخلة.
 * maxWords: عدد الكلمات في كل قطعة.
 * overlap : كلمات التداخل بين القطع المتجاورة.
 */
export function chunkText(
  text: string,
  maxWords = 120,
  overlap = 20
): string[] {
  const words = text.trim().split(/\s+/);
  if (!words.length || !text.trim()) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + maxWords).join(" "));
    i += maxWords - overlap;
  }
  return chunks;
}

// ── RAG: find relevant chunks ─────────────────────────────────────────────────

/**
 * يُرجع أكثر topK قطع ذات صلة دلالية بالسؤال query.
 * تُستخدَم لتعزيز الـ system prompt بالسياق الأنسب.
 */
export async function findRelevantChunks(
  query: string,
  chunks: string[],
  hfToken: string,
  topK = 3
): Promise<string[]> {
  if (!chunks.length || !query.trim()) return [];

  const allTexts = [query, ...chunks];
  const embs = await embedTexts(allTexts, hfToken);

  const queryEmb  = embs[0];
  const chunkEmbs = embs.slice(1);

  const scored = chunkEmbs.map((emb, i) => ({
    chunk: chunks[i],
    score: cosineSim(queryEmb, emb),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}
