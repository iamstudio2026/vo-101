// Firestore rules for the shared office, run against the emulator with the real rules:
//   npm run test:rules
// Three people: the owner (dueña), a member (ana) and an outsider (eve).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  addDoc, collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, limit, orderBy,
  query, setDoc, terminate, updateDoc, where, type Firestore,
} from 'firebase/firestore';

const apps: FirebaseApp[] = [];

const PROJECT = 'demo-vo101-rules';
const FS = '127.0.0.1:8085';
const BASE = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents`;

async function seed(path: string, fields: Record<string, unknown>) {
  const toValue = (v: unknown): unknown =>
    Array.isArray(v) ? { arrayValue: { values: v.map(toValue) } } :
    typeof v === 'number' ? { integerValue: String(v) } :
    { stringValue: String(v) };
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toValue(v)])) };
  const r = await fetch(`${BASE}/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, 200, await r.text());
}

async function as(name: string): Promise<{ db: Firestore; uid: string }> {
  const app: FirebaseApp = initializeApp({ projectId: PROJECT, apiKey: 'fake' }, name);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(
    JSON.stringify({ sub: name, email: `${name}@oficina.test`, email_verified: true })));
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  return { db, uid: cred.user.uid };
}

const denied = async (p: Promise<unknown>) => {
  await assert.rejects(p, (e: any) => /permission/i.test(String(e?.code || e?.message)));
};

let owner: { db: Firestore; uid: string };
let ana: { db: Firestore; uid: string };
let eve: { db: Firestore; uid: string };
const OFFICE = 'office-snsp';

before(async () => {
  owner = await as('duena');
  ana = await as('ana');
  eve = await as('eve');
  await seed(`offices/${OFFICE}`, { name: 'SNSP', ownerId: owner.uid, createdAt: '2026-10-20', memberIds: [owner.uid, ana.uid] });
  await seed('workers/w-marc', { officeId: OFFICE, name: 'Marc', role: 'Epi', status: 'available', ownerId: owner.uid, createdAt: '2026-10-20' });
  await seed('tasks/t-owner', { officeId: OFFICE, title: 'Brief', status: 'done', ownerId: owner.uid, createdAt: '2026-10-20' });
  await seed('messages/m1', { officeId: OFFICE, senderId: owner.uid, senderName: 'Dueña', message: 'Hola equipo', timestamp: 1, type: 'public', ownerId: owner.uid });
  await seed('knowledge/k1', { officeId: OFFICE, title: 'SINAVE', content: 'domingo a sábado', type: 'text', ownerId: owner.uid, createdAt: '2026-10-20' });
});

// Open SDK connections would keep node --test alive forever.
after(async () => {
  for (const a of apps) {
    await terminate(getFirestore(a));
    await deleteApp(a);
  }
});

test('members share the chat: same messages for owner and member, nothing for outsiders', async () => {
  const q = (db: Firestore) => query(collection(db, 'messages'), where('officeId', '==', OFFICE), orderBy('timestamp', 'desc'), limit(20));
  assert.equal((await getDocs(q(owner.db))).size, 1);
  assert.equal((await getDocs(q(ana.db))).size, 1);
  await denied(getDocs(q(eve.db)));
});

test('a member writes in the shared chat as themself, never as someone else', async () => {
  const msg = (senderId: string) => ({ officeId: OFFICE, senderId, senderName: 'Ana', message: 'Hola', timestamp: 2, type: 'public', ownerId: ana.uid });
  await addDoc(collection(ana.db, 'messages'), msg(ana.uid));
  await denied(addDoc(collection(ana.db, 'messages'), msg(owner.uid)));
  await denied(addDoc(collection(eve.db, 'messages'), { ...msg(eve.uid), ownerId: eve.uid }));
});

test('members see the office in their list; outsiders do not', async () => {
  const mine = (u: { db: Firestore; uid: string }) => getDocs(query(collection(u.db, 'offices'), where('memberIds', 'array-contains', u.uid)));
  assert.deepEqual((await mine(ana)).docs.map(d => d.id), [OFFICE]);
  assert.equal((await mine(eve)).size, 0);
  await denied(getDoc(doc(eve.db, 'offices', OFFICE)));
});

test('nobody can add themselves (or others) to an office from the client', async () => {
  await denied(updateDoc(doc(eve.db, 'offices', OFFICE), { memberIds: [owner.uid, ana.uid, eve.uid] }));
  await denied(updateDoc(doc(ana.db, 'offices', OFFICE), { memberIds: [owner.uid, ana.uid, eve.uid] }));
  await denied(updateDoc(doc(owner.db, 'offices', OFFICE), { memberIds: [owner.uid, eve.uid] }));
  // creating an office that lists other people is refused; a personal one is fine
  await denied(setDoc(doc(eve.db, 'offices', 'trap'), { name: 'Trap', ownerId: eve.uid, createdAt: 'x', memberIds: [eve.uid, ana.uid] }));
  await setDoc(doc(eve.db, 'offices', 'eve-own'), { name: 'Mía', ownerId: eve.uid, createdAt: 'x', memberIds: [eve.uid] });
});

test('members may open/close the office but not rename it', async () => {
  await updateDoc(doc(ana.db, 'offices', OFFICE), { status: 'closed' });
  await denied(updateDoc(doc(ana.db, 'offices', OFFICE), { name: 'Otra' }));
  await updateDoc(doc(owner.db, 'offices', OFFICE), { name: 'SNSP Tamaulipas', status: 'open' });
});

test('tasks are shared: members create, read and approve; nobody moves them to another office', async () => {
  const tasksQ = (db: Firestore) => getDocs(query(collection(db, 'tasks'), where('officeId', '==', OFFICE)));
  assert.ok((await tasksQ(ana.db)).size >= 1);
  await denied(tasksQ(eve.db));
  await addDoc(collection(ana.db, 'tasks'), { officeId: OFFICE, title: 'Calendario', status: 'todo', ownerId: ana.uid, createdAt: 'x', autoAssign: true });
  await updateDoc(doc(ana.db, 'tasks', 't-owner'), { approval: 'approved', phase: 'done' });
  await denied(updateDoc(doc(ana.db, 'tasks', 't-owner'), { officeId: 'eve-own' }));
  await denied(updateDoc(doc(ana.db, 'tasks', 't-owner'), { ownerId: ana.uid }));
  await denied(addDoc(collection(eve.db, 'tasks'), { officeId: OFFICE, title: 'x', status: 'todo', ownerId: eve.uid, createdAt: 'x' }));
});

test('only the owner manages workers; members can see them', async () => {
  const workersQ = (db: Firestore) => getDocs(query(collection(db, 'workers'), where('officeId', '==', OFFICE)));
  assert.equal((await workersQ(ana.db)).size, 1);
  await denied(addDoc(collection(ana.db, 'workers'), { officeId: OFFICE, name: 'Pirata', role: 'x', status: 'available', ownerId: ana.uid, createdAt: 'x' }));
  await addDoc(collection(owner.db, 'workers'), { officeId: OFFICE, name: 'Leo', role: 'Redactor', status: 'available', ownerId: owner.uid, createdAt: 'x' });
  await denied(workersQ(eve.db));
});

test('knowledge is shared with members and closed to outsiders', async () => {
  const kq = (db: Firestore) => getDocs(query(collection(db, 'knowledge'), where('officeId', '==', OFFICE), orderBy('createdAt', 'desc')));
  assert.equal((await kq(ana.db)).size, 1);
  await addDoc(collection(ana.db, 'knowledge'), { officeId: OFFICE, title: 'Nota de Ana', content: 'x', type: 'text', ownerId: ana.uid, createdAt: '2026-10-21' });
  await denied(kq(eve.db));
});
