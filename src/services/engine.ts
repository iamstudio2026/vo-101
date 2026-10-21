/// <reference types="vite/client" />
// Client for vo101-engine. The browser holds no model credentials: every AI call goes
// to the engine with the user's Firebase ID token, and task execution happens only there.
import { auth } from '../firebase';
import { gzipBase64 } from '../lib/gzip';

const ENGINE_URL = (import.meta.env.VITE_ENGINE_URL || '/engine').replace(/\/$/, '');

export class EngineError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

async function getJson<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

async function request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await send(method, path, body);
  return res.json() as Promise<T>;
}

async function send(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new EngineError(401, 'Inicia sesión para usar la IA.');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new EngineError(0, 'No se pudo contactar al motor de NEXUS.');
  }
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string') detail = data.detail;
    } catch { /* non-JSON error body */ }
    throw new EngineError(res.status, detail);
  }
  return res;
}

const del = <T>(path: string) => request<T>('DELETE', path);
const office = (id: string) => `/offices/${encodeURIComponent(id)}`;

export const refineTask = (title: string, description = '') =>
  post<{ title: string; description: string; department: string | null }>('/ai/refine', { title, description });

export const suggestWorker = (officeId: string, title: string, description = '') =>
  post<{ worker_id: string | null }>('/ai/assign', { office_id: officeId, title, description });

export const planFlow = (officeId: string, goal: string) =>
  post<{ tasks: { title: string; description: string }[] }>('/ai/flow', { office_id: officeId, goal });

export const askAssistant = (messages: { role: 'user' | 'ai'; text: string }[], deep = false) =>
  post<{ text: string }>('/ai/assistant', { messages, deep });

export const analyzeImage = (imageDataUrl: string, prompt = '') =>
  post<{ text: string }>('/ai/vision', { image: imageDataUrl, prompt });

export const analyzeAudio = (base64: string, mimeType: string) =>
  post<{ text: string }>('/ai/audio', { data: base64, mime_type: mimeType });

/** Ask a worker to answer in the group channel; the engine writes the reply to Firestore. */
export const chatRespond = (officeId: string, message: string, workerId?: string, deep = false) =>
  post<{ message_id: string; worker_id: string }>('/chat/respond', {
    office_id: officeId,
    message,
    worker_id: workerId ?? null,
    deep,
  });

// --- Shared office: members ----------------------------------------------------
/** Owner only. An existing verified account is added; otherwise an invitation is left. */
export const inviteMember = (officeId: string, email: string) =>
  post<{ status: 'added' | 'invited'; email: string; uid?: string }>(`/offices/${encodeURIComponent(officeId)}/members`, { email });

export const removeMember = (officeId: string, memberUid: string) =>
  request<{ removed: string }>('DELETE', `/offices/${encodeURIComponent(officeId)}/members/${encodeURIComponent(memberUid)}`);

export const cancelInvite = (officeId: string, email: string) =>
  request<{ cancelled: string }>('DELETE', `/offices/${encodeURIComponent(officeId)}/invites?email=${encodeURIComponent(email)}`);

/** After sign-in: join the offices that invited this (verified) email. */
export const claimInvites = () => post<{ joined: string[] }>('/me/claim-invites', {});

// --- Skills (habilidades) --------------------------------------------------------
export interface SkillInfo { id: string; name: string; description: string; inputs: string[] }

export const listSkills = () => getJson<{ skills: SkillInfo[] }>('/skills');

/** Owner only: add the template's workers, context note and skills to the office. */
export const applyTemplate = (officeId: string, templateId: string) =>
  post<{ workers_created: string[]; note_added: boolean; skills: string[] }>(
    `/offices/${encodeURIComponent(officeId)}/templates/${encodeURIComponent(templateId)}`, {});

export interface BulletinInspection {
  upload_id: string;
  filename: string;
  rows: number;
  columns: string[];
  detected: Record<string, string | null>;
  role_labels: Record<string, string>;
  status_values: { value: string; count: number }[];
  suggested_status: Record<string, string>;
  assumptions: string[];
  date_range: [string, string] | null;
  suggested_period?: { year: number; week: number };
  entidad_values: { value: string; count: number }[];
  saved_settings: { mapping?: Record<string, string | null>; statusMap?: Record<string, string>; region?: string; entidad?: string };
}

export const inspectBulletinFile = async (officeId: string, file: File) =>
  post<BulletinInspection>('/skills/boletin_epidemiologico/inspect', {
    office_id: officeId,
    filename: file.name,
    data_gz_b64: await gzipBase64(file),
  });

export const runBulletin = (body: {
  office_id: string;
  upload_id: string;
  mapping: Record<string, string | null>;
  status_map: Record<string, string>;
  params: { year?: number; week?: number; region: string; entidad: string };
}) => post<{ task_id: string; assigned_to: string | null }>('/skills/boletin_epidemiologico/run', body);

export const runEvidenceReview = (officeId: string, question: string, years = 10, maxArticles = 12) =>
  post<{ task_id: string; assigned_to: string | null }>('/skills/revision_evidencia/run', {
    office_id: officeId, question, years, max_articles: maxArticles,
  });

// --- Population (rates per 100 000) -----------------------------------------------------
export interface PopulationSummary {
  filename: string; uploadedAt: string; years: number[]; municipios: number; total: Record<string, number>;
}

export const uploadPopulation = async (officeId: string, file: File) =>
  post<PopulationSummary>(`${office(officeId)}/population`, {
    office_id: officeId, filename: file.name, data_gz_b64: await gzipBase64(file),
  });

export const deletePopulation = (officeId: string) => del<{ ok: boolean }>(`${office(officeId)}/population`);

// --- Skill: outbreak analysis -----------------------------------------------------------
export interface OutbreakInspection {
  upload_id: string;
  filename: string;
  rows: number;
  columns: string[];
  detected: Record<string, string | null>;
  role_labels: Record<string, string>;
  suggested_exposures: string[];
  date_range: [string, string] | null;
  caso_values: { value: string; count: number }[];
}

export const inspectOutbreakFile = async (officeId: string, file: File) =>
  post<OutbreakInspection>('/skills/analisis_brote/inspect', {
    office_id: officeId, filename: file.name, data_gz_b64: await gzipBase64(file),
  });

export const runOutbreak = (body: {
  office_id: string;
  upload_id: string;
  mapping: Record<string, string | null>;
  params: { evento: string; lugar: string; expuestos?: number; exposicion_comun: string; exposiciones: string[]; contexto: string };
}) => post<{ task_id: string; assigned_to: string | null }>('/skills/analisis_brote/run', body);

// --- Skill: institutional documents -----------------------------------------------------
export interface DocPerson { nombre: string; cargo: string; institucion?: string }
export interface DocHeader {
  dependencia: string; area: string; numero: string; lugar: string; asunto: string;
  destinatario: DocPerson; remitente: DocPerson; ccp: string[];
}
export type DocType = 'oficio' | 'nota_informativa' | 'informe_tecnico';

export const runDocument = (body: {
  office_id: string; tipo: DocType; encabezado: DocHeader; instrucciones: string; source_task_id?: string;
}) => post<{ task_id: string; assigned_to: string | null }>('/skills/documento_institucional/run', body);

export const uploadDocTemplate = async (officeId: string, file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return post<{ filename: string }>(`${office(officeId)}/doc-template`, { filename: file.name, data_b64: btoa(binary) });
};

export const deleteDocTemplate = (officeId: string) => del<{ ok: boolean }>(`${office(officeId)}/doc-template`);

/** Any delivered task as Word (.docx), built by the engine on the office's letterhead. */
export async function downloadTaskDocx(taskId: string, title: string): Promise<void> {
  const res = await send('GET', `/tasks/${encodeURIComponent(taskId)}/docx`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'documento'}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
