// node --test tests/   (Node ≥ 23 runs TypeScript directly)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_BEAT_MS, pickTaskToPlay, scriptFor, step, type ScriptTask } from '../src/lib/choreography.ts';

const T0 = Date.parse('2026-10-20T17:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString();

function task(over: Partial<ScriptTask> = {}): ScriptTask {
  return { id: 't1', status: 'in-progress', assignedTo: 'marc', createdAt: iso(T0), ...over };
}

test('an avatar never runs ahead of the engine', () => {
  const t = task({ phaseLog: [{ phase: 'claimed', at: iso(T0) }, { phase: 'executing', at: iso(T0) }] });
  let ph = { beatIndex: 0 } as { beatIndex: number; arrivedAt?: number };
  // claimed → executing after its hold
  let s = step(t, ph, true, T0);
  assert.equal(s.kind, 'perform');
  ph = (s as any).playhead;
  s = step(t, ph, true, T0 + MIN_BEAT_MS.claimed);
  assert.equal((s as any).beat.phase, 'executing');
  ph = (s as any).playhead;
  // executing is the last beat that happened: hold there no matter how long
  s = step(t, ph, true, T0 + 60 * 60 * 1000);
  assert.equal((s as any).beat.phase, 'executing');
  s = step(t, (s as any).playhead, true, T0 + 2 * 60 * 60 * 1000);
  assert.equal((s as any).beat.phase, 'executing');
});

test('a fast engine run is replayed beat by beat, each held on screen', () => {
  const log = ['claimed', 'executing', 'reviewing', 'revising', 'reviewing', 'done'] as const;
  const t = task({ status: 'done', phase: 'done', phaseLog: log.map(p => ({ phase: p, at: iso(T0) })) });
  let ph = { beatIndex: 0 } as { beatIndex: number; arrivedAt?: number };
  let now = T0;
  const seen: string[] = [];
  for (let i = 0; i < 200; i++) {
    const s = step(t, ph, true, now);
    if (s.kind === 'finished') break;
    if (seen[seen.length - 1] !== s.beat.phase || s.playhead.beatIndex !== ph.beatIndex) seen.push(s.beat.phase);
    ph = s.playhead;
    now += 500;
  }
  assert.deepEqual(seen, [...log]);
});

test('the hold only starts once the avatar reaches the station', () => {
  const t = task({ phaseLog: [{ phase: 'executing', at: iso(T0) }, { phase: 'reviewing', at: iso(T0) }] });
  // walking for a long time does not consume the executing beat
  let s = step(t, { beatIndex: 0 }, false, T0 + 60_000);
  assert.equal((s as any).beat.phase, 'executing');
  assert.equal((s as any).playhead.arrivedAt, undefined);
  s = step(t, (s as any).playhead, true, T0 + 61_000);
  s = step(t, (s as any).playhead, true, T0 + 61_000 + MIN_BEAT_MS.executing - 1);
  assert.equal((s as any).beat.phase, 'executing');
  s = step(t, (s as any).playhead, true, T0 + 61_000 + MIN_BEAT_MS.executing);
  assert.equal((s as any).beat.phase, 'reviewing');
  assert.equal((s as any).scene.station, 'qa');
});

test('awaiting approval holds until the approval beat arrives, then delivers', () => {
  const base = [{ phase: 'reviewing', at: iso(T0) }, { phase: 'awaiting_approval', at: iso(T0) }] as any;
  const waiting = task({ status: 'done', phase: 'awaiting_approval', approval: 'pending', phaseLog: base });
  let s = step(waiting, { beatIndex: 1 }, true, T0);
  s = step(waiting, (s as any).playhead, true, T0 + 10 * 60 * 1000);
  assert.equal((s as any).scene.action, 'waiting_approval');
  assert.equal((s as any).scene.station, 'dispatch');

  const approved = task({ status: 'done', phase: 'done', approval: 'approved',
    phaseLog: [...base, { phase: 'done', at: iso(T0 + 1000), by: 'human' }] });
  s = step(approved, (s as any).playhead, true, T0 + 11 * 60 * 1000);
  assert.equal((s as any).beat.phase, 'done');
  assert.equal((s as any).scene.station, 'storage');
});

test('legacy tasks without phaseLog still get a short honest script', () => {
  assert.deepEqual(scriptFor(task({ status: 'todo' })).map(b => b.phase), ['queued']);
  assert.deepEqual(scriptFor(task({ status: 'in-progress' })).map(b => b.phase), ['claimed', 'executing']);
  assert.deepEqual(scriptFor(task({ status: 'done' })).map(b => b.phase), ['executing', 'done']);
});

test('what to act out next: live work, then fresh results, then approvals', () => {
  const session = T0;
  const old = task({ id: 'old', status: 'done', phaseAt: iso(T0 - 1000) });
  const fresh = task({ id: 'fresh', status: 'done', phaseAt: iso(T0 + 1000) });
  const wait = task({ id: 'wait', status: 'done', phase: 'awaiting_approval', approval: 'pending', phaseAt: iso(T0 - 5000) });
  const live = task({ id: 'live', status: 'todo' });
  const other = task({ id: 'other', status: 'todo', assignedTo: 'ana' });

  assert.equal(pickTaskToPlay([old, fresh, wait, live, other], 'marc', new Set(), session)?.id, 'live');
  assert.equal(pickTaskToPlay([old, fresh, wait], 'marc', new Set(), session)?.id, 'fresh');
  assert.equal(pickTaskToPlay([old, fresh, wait], 'marc', new Set(['fresh']), session)?.id, 'wait');
  assert.equal(pickTaskToPlay([old], 'marc', new Set(), session), undefined); // old results are not replayed
  assert.equal(pickTaskToPlay([task({ status: 'todo', failed: true })], 'marc', new Set(), session), undefined);
});
