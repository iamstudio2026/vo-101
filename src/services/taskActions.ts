// Task writes the user can trigger. The engine runs tasks; these only change intent.
import { arrayUnion, deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Fields the engine uses to schedule a task; cleared when a task goes back to its queue.
export const REQUEUE_FIELDS = {
  status: 'todo' as const,
  attempts: 0,
  failed: false,
  lastError: deleteField(),
  notBefore: deleteField(),
  approval: deleteField(),
  humanFeedback: deleteField(),
};

/** Accept a deliverable the engine held for approval. Adds the closing beat to its script. */
export async function approveTask(taskId: string) {
  const at = new Date().toISOString();
  await updateDoc(doc(db, 'tasks', taskId), {
    approval: 'approved',
    approvedAt: at,
    phase: 'done',
    phaseAt: at,
    phaseLog: arrayUnion({ phase: 'done', at, by: 'human' }),
  });
}

/** Send a deliverable back with the user's notes; the engine revises the previous result. */
export async function requestChanges(taskId: string, feedback: string) {
  const at = new Date().toISOString();
  await updateDoc(doc(db, 'tasks', taskId), {
    ...REQUEUE_FIELDS,
    approval: 'changes_requested',
    humanFeedback: feedback.trim().slice(0, 1500),
    phase: 'queued',
    phaseAt: at,
  });
}

/** Run a task again from scratch. */
export async function requeueTask(taskId: string, autoAssign: boolean) {
  await updateDoc(doc(db, 'tasks', taskId), {
    ...REQUEUE_FIELDS,
    ...(autoAssign ? { autoAssign: true } : {}),
  });
}
