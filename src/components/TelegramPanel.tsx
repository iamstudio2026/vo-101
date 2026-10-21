import React, { useEffect, useState } from 'react';
import { Send, Loader2, X, Link2 } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';

// Chats that receive the office's deliverables. The owner gets a one-time link; whoever
// opens it in Telegram (a person, or a group the bot was added to) is linked to the office.
export const TelegramPanel: React.FC<{ office: Office; currentUid: string }> = ({ office, currentUid }) => {
  const isOwner = office.ownerId === currentUid;
  const [status, setStatus] = useState<{ enabled: boolean; bot: string | null } | null>(null);
  const [link, setLink] = useState<{ url: string; groupUrl: string; bot: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chats = office.telegramChats ?? [];

  useEffect(() => {
    engine.telegramStatus().then(setStatus).catch(() => setStatus({ enabled: false, bot: null }));
  }, []);

  const newLink = async () => {
    setBusy(true);
    setError(null);
    try {
      setLink(await engine.telegramLink(office.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el enlace.');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (chatId: string) => {
    setBusy(true);
    try {
      await engine.telegramUnlink(office.id, chatId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el chat.');
    } finally {
      setBusy(false);
    }
  };

  if (status && !status.enabled && !chats.length) {
    return <p className="mt-3 text-[11px] text-slate-400 flex items-center gap-1"><Send className="w-3 h-3" /> Telegram: pendiente de configurar en el motor.</p>;
  }

  return (
    <div className="mt-3 p-3 rounded-xl bg-sky-50/60 border border-sky-100 text-xs">
      <p className="font-semibold text-slate-700 flex items-center gap-1"><Send className="w-3.5 h-3.5 text-sky-600" /> Telegram</p>
      {chats.length ? (
        <ul className="mt-1 space-y-1">
          {chats.map(c => (
            <li key={c.id} className="flex items-center gap-2 text-slate-600">
              {c.type === 'private' ? '👤' : '👥'} {c.title}
              {isOwner && (
                <button onClick={() => unlink(c.id)} disabled={busy} title="Dejar de enviar a este chat"
                        className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-slate-500">Ningún chat recibe todavía los entregables de esta oficina.</p>
      )}
      {isOwner && status?.enabled && (
        <div className="mt-2">
          {!link ? (
            <button onClick={newLink} disabled={busy}
                    className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline disabled:opacity-50">
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Conectar un chat
            </button>
          ) : (
            <div className="space-y-1 text-slate-600">
              <p>El enlace sirve una vez y vence en 30 minutos:</p>
              <p>• Para ti: <a href={link.url} target="_blank" rel="noreferrer" className="text-sky-700 underline">abrir @{link.bot}</a> y pulsar «Iniciar».</p>
              <p>• Para un grupo: <a href={link.groupUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">agregar @{link.bot} al grupo</a>.</p>
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-rose-600">{error}</p>}
    </div>
  );
};
