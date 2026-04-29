/**
 * figma.ts — Figma REST API client
 * https://www.figma.com/developers/api
 */

const FIGMA_BASE = "https://api.figma.com/v1";

async function figmaFetch(path: string, token: string) {
  const res = await fetch(`${FIGMA_BASE}${path}`, {
    headers: { "X-Figma-Token": token },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`Figma ${res.status}: ${data?.message || text.slice(0, 200)}`);
  return data;
}

// ── ملف كامل ──────────────────────────────────────────────────────────────────
export async function getFigmaFile(token: string, fileKey: string) {
  const data = await figmaFetch(`/files/${fileKey}?depth=2`, token);
  return {
    name:          data.name,
    lastModified:  data.lastModified,
    thumbnailUrl:  data.thumbnailUrl,
    version:       data.version,
    pages: (data.document?.children || []).map((p: any) => ({
      id:       p.id,
      name:     p.name,
      type:     p.type,
      children: (p.children || []).slice(0, 20).map((c: any) => ({
        id: c.id, name: c.name, type: c.type,
      })),
    })),
  };
}

// ── nodes محددة ───────────────────────────────────────────────────────────────
export async function getFigmaNodes(token: string, fileKey: string, nodeIds: string[]) {
  const ids = nodeIds.join(",");
  const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}&depth=3`, token);
  return Object.entries(data.nodes || {}).map(([id, node]: [string, any]) => ({
    id,
    name:     node.document?.name,
    type:     node.document?.type,
    children: (node.document?.children || []).slice(0, 30).map((c: any) => ({
      id: c.id, name: c.name, type: c.type,
      absoluteBoundingBox: c.absoluteBoundingBox,
      fills: c.fills,
      strokes: c.strokes,
    })),
  }));
}

// ── components ────────────────────────────────────────────────────────────────
export async function getFigmaComponents(token: string, fileKey: string) {
  const data = await figmaFetch(`/files/${fileKey}/components`, token);
  const meta = data.meta?.components || [];
  return meta.slice(0, 50).map((c: any) => ({
    key:         c.key,
    name:        c.name,
    description: c.description,
    nodeId:      c.node_id,
    pageName:    c.containing_frame?.pageName,
    frameName:   c.containing_frame?.name,
  }));
}

// ── styles ────────────────────────────────────────────────────────────────────
export async function getFigmaStyles(token: string, fileKey: string) {
  const data = await figmaFetch(`/files/${fileKey}/styles`, token);
  const meta = data.meta?.styles || [];
  return meta.map((s: any) => ({
    key:         s.key,
    name:        s.name,
    styleType:   s.style_type,   // FILL | TEXT | EFFECT | GRID
    description: s.description,
    nodeId:      s.node_id,
  }));
}

// ── comments ──────────────────────────────────────────────────────────────────
export async function getFigmaComments(token: string, fileKey: string) {
  const data = await figmaFetch(`/files/${fileKey}/comments`, token);
  return (data.comments || []).slice(0, 30).map((c: any) => ({
    id:        c.id,
    message:   c.message,
    author:    c.user?.handle,
    createdAt: c.created_at,
    resolved:  c.resolved_at !== null,
  }));
}

// ── تصدير صور nodes ───────────────────────────────────────────────────────────
export async function exportFigmaNodes(token: string, fileKey: string, nodeIds: string[], format = "PNG", scale = 1) {
  const ids = nodeIds.join(",");
  const data = await figmaFetch(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${scale}`,
    token
  );
  return { images: data.images || {}, err: data.err };
}

// ── مشاريع الـ team ──────────────────────────────────────────────────────────
export async function getFigmaTeamProjects(token: string, teamId: string) {
  const data = await figmaFetch(`/teams/${teamId}/projects`, token);
  return (data.projects || []).map((p: any) => ({ id: p.id, name: p.name }));
}

// ── ملفات مشروع ───────────────────────────────────────────────────────────────
export async function getFigmaProjectFiles(token: string, projectId: string) {
  const data = await figmaFetch(`/projects/${projectId}/files`, token);
  return (data.files || []).map((f: any) => ({
    key:          f.key,
    name:         f.name,
    thumbnailUrl: f.thumbnail_url,
    lastModified: f.last_modified,
  }));
}
