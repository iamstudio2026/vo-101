// Turns the engine's phaseLog into scenes the office simulation acts out.
//
// Rule: an avatar only performs a beat that really happened. The engine is often
// faster than a person can watch, so each beat is held on screen for a minimum time and
// the script is replayed in order; what the avatar never does is run ahead of the engine.
// Pure module (no React/Firebase) so it can be tested with `node --test`.

export type Phase =
  | 'queued' | 'claimed' | 'executing' | 'reviewing' | 'revising'
  | 'done' | 'awaiting_approval' | 'failed';

export interface Beat {
  phase: Phase;
  at: string;
  [extra: string]: unknown;
}

export interface ScriptTask {
  id: string;
  status: string;
  assignedTo?: string | null;
  createdAt?: string;
  phase?: string;
  phaseAt?: string;
  phaseLog?: ReadonlyArray<{ phase: string; at: string; [extra: string]: unknown }>;
  approval?: string;
  failed?: boolean;
}

export type Station = 'here' | 'department' | 'qa' | 'dispatch' | 'storage';
export type SceneAction = 'thinking' | 'working' | 'reviewing' | 'waiting_approval' | 'delivering' | 'error';

export interface Scene {
  station: Station;
  action: SceneAction;
  label: string;
  progress: number; // 0–100, shown in the citizen panel
}

export const SCENES: Record<Phase, Scene> = {
  queued: { station: 'here', action: 'thinking', label: 'En cola', progress: 5 },
  claimed: { station: 'here', action: 'thinking', label: 'Analizando', progress: 15 },
  executing: { station: 'department', action: 'working', label: 'Procesando', progress: 45 },
  reviewing: { station: 'qa', action: 'reviewing', label: 'En revisión', progress: 75 },
  revising: { station: 'department', action: 'working', label: 'Corrigiendo', progress: 60 },
  awaiting_approval: { station: 'dispatch', action: 'waiting_approval', label: 'Espera tu visto bueno', progress: 95 },
  done: { station: 'storage', action: 'delivering', label: 'Entregando', progress: 100 },
  failed: { station: 'here', action: 'error', label: 'Falló', progress: 0 },
};

/** Minimum time a beat stays on screen once the avatar is at its station. */
export const MIN_BEAT_MS: Record<Phase, number> = {
  queued: 2500,
  claimed: 2500,
  executing: 6000,
  reviewing: 5000,
  revising: 5000,
  awaiting_approval: 0, // held by the approval itself, not by a timer
  done: 2000,
  failed: 4000,
};

const LIVE = new Set(['todo', 'in-progress']);

/** The beats to perform for a task. Tasks from before phaseLog existed get a minimal script. */
export function scriptFor(task: ScriptTask): Beat[] {
  // Unknown phases (a newer engine) are shown as "En cola" rather than breaking the scene.
  if (task.phaseLog && task.phaseLog.length > 0) {
    return task.phaseLog.map(b => ({ ...b, phase: (b.phase in SCENES ? b.phase : 'queued') as Phase }));
  }
  const at = task.phaseAt || task.createdAt || new Date(0).toISOString();
  if (task.status === 'in-progress') return [{ phase: 'claimed', at }, { phase: 'executing', at }];
  if (task.status === 'done') return [{ phase: 'executing', at }, { phase: 'done', at }];
  return [{ phase: 'queued', at }];
}

export function isLive(task: ScriptTask): boolean {
  return LIVE.has(task.status) && !task.failed;
}

export function isAwaitingApproval(task: ScriptTask): boolean {
  return task.phase === 'awaiting_approval' && task.approval === 'pending';
}

/**
 * Which task a free avatar should act out next, in priority order:
 * 1. live work (todo / in-progress),
 * 2. work finished while this page was open that hasn't been shown yet,
 * 3. a deliverable waiting for the user's approval (the avatar waits at dispatch).
 */
export function pickTaskToPlay(
  tasks: ScriptTask[], workerId: string, played: ReadonlySet<string>, sessionStart: number,
): ScriptTask | undefined {
  const mine = tasks.filter(t => t.assignedTo === workerId);
  const byAge = (a: ScriptTask, b: ScriptTask) => (a.createdAt || '').localeCompare(b.createdAt || '');
  const live = mine.filter(isLive).sort(byAge);
  if (live.length) return live[0];
  const fresh = mine
    .filter(t => !played.has(t.id) && t.status === 'done' && t.phaseAt && Date.parse(t.phaseAt) >= sessionStart)
    .sort(byAge);
  if (fresh.length) return fresh[0];
  return mine.filter(t => !played.has(t.id) && isAwaitingApproval(t)).sort(byAge)[0];
}

export interface Playhead {
  beatIndex: number;
  arrivedAt?: number; // when the avatar reached the current beat's station
}

export type Step =
  | { kind: 'perform'; beat: Beat; scene: Scene; playhead: Playhead }
  | { kind: 'finished' };

/**
 * Advance the playhead at most one beat. `arrived` says whether the avatar is standing
 * at the station of the beat it is currently performing.
 */
export function step(task: ScriptTask, playhead: Playhead, arrived: boolean, now: number): Step {
  const beats = scriptFor(task);
  let index = Math.min(playhead.beatIndex, beats.length - 1);
  let arrivedAt = playhead.arrivedAt;
  if (arrived && arrivedAt === undefined) arrivedAt = now;

  const beat = beats[index];
  const held = arrivedAt !== undefined && now - arrivedAt >= (MIN_BEAT_MS[beat.phase] ?? 3000);
  const isLast = index === beats.length - 1;

  if (held && !isLast) {
    index += 1;
    arrivedAt = undefined;
  } else if (held && isLast && (beat.phase === 'done' || beat.phase === 'failed')) {
    return { kind: 'finished' };
  } else if (isLast && beat.phase === 'awaiting_approval' && !isAwaitingApproval(task)) {
    // approved elsewhere without a new beat being written: nothing more to show
    if (held || arrivedAt !== undefined) return { kind: 'finished' };
  }

  const current = beats[index];
  return { kind: 'perform', beat: current, scene: SCENES[current.phase] ?? SCENES.queued, playhead: { beatIndex: index, arrivedAt } };
}
