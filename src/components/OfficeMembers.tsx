import React, { useState } from 'react';
import { Users, UserPlus, X, Mail, Crown, Loader2 } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';

// Who shares this office. The owner invites people of the real office by email; an
// existing verified account joins at once, anyone else joins when they first sign in.
export const OfficeMembers: React.FC<{ office: Office; currentUid: string }> = ({ office, currentUid }) => {
  const isOwner = office.ownerId === currentUid;
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const memberIds = Array.from(new Set([office.ownerId, ...(office.memberIds || [])]));
  const profileOf = (uid: string) => office.memberProfiles?.[uid];
  const labelOf = (uid: string) =>
    uid === currentUid ? 'Tú' : profileOf(uid)?.name || profileOf(uid)?.email || (uid === office.ownerId ? 'Dueño' : 'Miembro');

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice(await action());
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      setBusy(false);
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    run(async () => {
      const r = await engine.inviteMember(office.id, address);
      setEmail('');
      return r.status === 'added'
        ? `${r.email} ya es miembro de la oficina.`
        : `Invitación guardada: ${r.email} entrará a la oficina cuando inicie sesión con ese correo.`;
    });
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        <Users className="w-3.5 h-3.5" /> Miembros ({memberIds.length})
      </div>
      <ul className="flex flex-wrap gap-2">
        {memberIds.map(uid => (
          <li key={uid} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full pl-2.5 pr-1.5 py-1">
            {uid === office.ownerId && <Crown className="w-3 h-3 text-amber-500" />}
            <span className="text-slate-700" title={profileOf(uid)?.email}>{labelOf(uid)}</span>
            {isOwner && uid !== office.ownerId && (
              <button
                onClick={() => run(async () => { await engine.removeMember(office.id, uid); return 'Miembro quitado.'; })}
                disabled={busy}
                className="p-0.5 text-slate-400 hover:text-rose-500 rounded-full"
                title="Quitar de la oficina"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
        {(office.pendingEmails || []).map(addr => (
          <li key={addr} className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 rounded-full pl-2.5 pr-1.5 py-1 text-amber-800">
            <Mail className="w-3 h-3" /> {addr} · pendiente
            {isOwner && (
              <button
                onClick={() => run(async () => { await engine.cancelInvite(office.id, addr); return 'Invitación cancelada.'; })}
                disabled={busy}
                className="p-0.5 text-amber-500 hover:text-rose-500 rounded-full"
                title="Cancelar invitación"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={invite} className="mt-3 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@oficina.gob.mx"
            className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invitar
          </button>
        </form>
      )}
      {notice && <p className="mt-2 text-xs text-slate-600">{notice}</p>}
    </div>
  );
};
