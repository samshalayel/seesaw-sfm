/**
 * pdfIndexer.ts
 * يستخرج النص من PDF، يقسّمه، ويحسب embeddings ويخزّنها.
 * الفهرس يُخزَّن في: server/data/pdf_index_{name}.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const pdfParse: (buf: Buffer) => Promise<{ text: string; numpages: number }> = _require("pdf-parse");
import { embedTexts, chunkText, findRelevantChunks } from "./embeddings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");

// ── تأكد من وجود مجلد البيانات ──────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface PdfChunk {
  text: string;
  embedding: number[];
  page?: number;
  source: string;
}

export interface PdfIndex {
  name: string;
  source: string;
  createdAt: string;
  chunkCount: number;
  chunks: PdfChunk[];
}

function getIndexPath(name: string) {
  ensureDataDir();
  return path.join(DATA_DIR, `pdf_index_${name}.json`);
}

// ── قراءة الفهرس من الديسك ──────────────────────────────────────────────────
export function loadPdfIndex(name: string): PdfIndex | null {
  const p = getIndexPath(name);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}

// ── بناء الفهرس من ملف PDF ──────────────────────────────────────────────────
export async function indexPdfFile(
  pdfPath: string,
  name: string,
  hfToken: string,
  chunkSize = 150,
  overlap = 30,
  onProgress?: (msg: string) => void
): Promise<PdfIndex> {
  onProgress?.(`📄 قراءة الـ PDF...`);

  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdfParse(buffer);
  const fullText = parsed.text.replace(/\s+/g, " ").trim();

  onProgress?.(`📝 النص المستخرج: ${fullText.length} حرف — ${parsed.numpages} صفحة`);

  const rawChunks = chunkText(fullText, chunkSize, overlap);
  onProgress?.(`✂️ تم التقسيم: ${rawChunks.length} قطعة`);

  // embed على دفعات (HF API يدعم حتى 100 نص دفعة)
  const BATCH = 64;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < rawChunks.length; i += BATCH) {
    const batch = rawChunks.slice(i, i + BATCH);
    onProgress?.(`🔢 Embedding ${i + 1}–${Math.min(i + BATCH, rawChunks.length)} / ${rawChunks.length}...`);
    const embs = await embedTexts(batch, hfToken);
    allEmbeddings.push(...embs);
  }

  const chunks: PdfChunk[] = rawChunks.map((text, i) => ({
    text,
    embedding: allEmbeddings[i],
    source: name,
  }));

  const index: PdfIndex = {
    name,
    source: pdfPath,
    createdAt: new Date().toISOString(),
    chunkCount: chunks.length,
    chunks,
  };

  fs.writeFileSync(getIndexPath(name), JSON.stringify(index));
  onProgress?.(`✅ الفهرس جاهز: ${chunks.length} قطعة مُفهرسة`);
  return index;
}

// ── بحث دلالي في الفهرس ─────────────────────────────────────────────────────
export async function searchPdfIndex(
  query: string,
  name: string,
  hfToken: string,
  topK = 4
): Promise<string[]> {
  const index = loadPdfIndex(name);
  if (!index) return [];

  const [queryEmb] = await embedTexts([query], hfToken);

  // ترتيب بالـ cosine similarity
  const { cosineSim } = await import("./embeddings");
  const scored = index.chunks.map(c => ({
    text: c.text,
    score: cosineSim(queryEmb, c.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.text);
}

// ── قائمة الفهارس المتاحة ────────────────────────────────────────────────────
export function listPdfIndexes(): string[] {
  ensureDataDir();
  return fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith("pdf_index_") && f.endsWith(".json"))
    .map(f => f.replace("pdf_index_", "").replace(".json", ""));
}
