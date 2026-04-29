/**
 * apidog.ts — APIdog API client
 * وثائق APIdog: https://docs.apidog.com/api-reference/
 */

const APIDOG_BASE = "https://api.apidog.com";

async function apidogFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${APIDOG_BASE}${path}`, {
    ...options,
    headers: {
      "X-Apidog-Api-Access-Token": token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`APIdog ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── قائمة المشاريع ────────────────────────────────────────────────────────────
export async function listProjects(token: string) {
  const data = await apidogFetch("/api/v1/user-authorized-projects?limit=100", token);
  return (data.data || []).map((p: any) => ({
    id:   p.id,
    name: p.name,
    type: p.type,
  }));
}

// ── قائمة الـ endpoints في مشروع ─────────────────────────────────────────────
export async function listEndpoints(token: string, projectId: string) {
  const data = await apidogFetch(`/api/v1/projects/${projectId}/api-details?limit=200`, token);
  return (data.data || []).map((e: any) => ({
    id:     e.id,
    name:   e.name,
    method: e.method,
    path:   e.path,
    status: e.status,
    folderId: e.folderId,
  }));
}

// ── تفاصيل endpoint واحد ─────────────────────────────────────────────────────
export async function getEndpoint(token: string, projectId: string, endpointId: string) {
  const data = await apidogFetch(`/api/v1/projects/${projectId}/api-details/${endpointId}`, token);
  return data.data || data;
}

// ── إنشاء endpoint جديد ───────────────────────────────────────────────────────
export async function createEndpoint(token: string, projectId: string, endpoint: {
  name: string;
  method: string;
  path: string;
  description?: string;
  folderId?: number;
  requestBody?: any;
  responses?: any[];
}) {
  const body = {
    name:        endpoint.name,
    method:      endpoint.method.toUpperCase(),
    path:        endpoint.path,
    description: endpoint.description || "",
    status:      "developing",
    ...(endpoint.folderId ? { folderId: endpoint.folderId } : {}),
    ...(endpoint.requestBody ? { requestBody: endpoint.requestBody } : {}),
    responses: endpoint.responses || [
      { code: "200", name: "Success", contentType: "application/json",
        jsonSchema: { type: "object", properties: {} } },
    ],
  };
  const data = await apidogFetch(`/api/v1/projects/${projectId}/api-details`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.data || data;
}

// ── تحديث endpoint موجود ──────────────────────────────────────────────────────
export async function updateEndpoint(token: string, projectId: string, endpointId: string, updates: {
  name?: string;
  method?: string;
  path?: string;
  description?: string;
  status?: string;
}) {
  const data = await apidogFetch(`/api/v1/projects/${projectId}/api-details/${endpointId}`, token, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  return data.data || data;
}

// ── قائمة المجلدات ────────────────────────────────────────────────────────────
export async function listFolders(token: string, projectId: string) {
  const data = await apidogFetch(`/api/v1/projects/${projectId}/api-detail-folders`, token);
  return (data.data || []).map((f: any) => ({ id: f.id, name: f.name, parentId: f.parentId }));
}

// ── تشغيل test scenario ───────────────────────────────────────────────────────
export async function runTestScenario(token: string, projectId: string, scenarioId: string) {
  const data = await apidogFetch(
    `/api/v1/projects/${projectId}/test-scenarios/${scenarioId}/runs`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
  return data.data || data;
}

// ── قائمة الـ test scenarios ──────────────────────────────────────────────────
export async function listTestScenarios(token: string, projectId: string) {
  const data = await apidogFetch(`/api/v1/projects/${projectId}/test-scenarios?limit=100`, token);
  return (data.data || []).map((s: any) => ({ id: s.id, name: s.name, status: s.status }));
}
