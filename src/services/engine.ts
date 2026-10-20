/// <reference types="vite/client" />
// Client for vo101-engine. The browser holds no model credentials: every AI call goes
// to the engine with the user's Firebase ID token, and task execution happens only there.
import { auth } from '../firebase';

const ENGINE_URL = (import.meta.env.VITE_ENGINE_URL || '/engine').replace(/\/$/, '');

export class EngineError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new EngineError(401, 'Inicia sesión para usar la IA.');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}/v1${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
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
  return res.json() as Promise<T>;
}

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
