import React, { useEffect, useState } from 'react';
import { Landmark, Loader2, Sparkles, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';

// The bulletin from the DGE open data: nothing to upload. Once now, or every week on its
// own (owner), as soon as the DGE publishes a new base; the result goes to the office's
// Telegram chats.
export const DgeBulletin: React.FC<{ office: Office; isOwner: boolean }> = ({ office, isOwner }) => {
  const schedule = office.bulletinSchedule;
  const [states, setStates] = useState<{ clave: string; nombre: string }[]>([]);
  const [entidad, setEntidad] = useState(schedule?.entidad ?? '');
  const [region, setRegion] = useState(schedule?.region ?? '');
  const [telegram, setTelegram] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hasChats = (office.telegramChats ?? []).length > 0;

  useEffect(() => {
    engine.dgeStates().then(r => setStates(r.entidades)).catch(() => setStates([]));
  }, []);

  const act = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo completar.' });
    } finally {
      setBusy(false);
    }
  };

  const runNow = () => act(async () => {
    await engine.runDgeBulletin({ office_id: office.id, entidad, region, telegram: telegram && hasChats });
    return 'Boletín en preparación con la base más reciente de la DGE. La primera vez tarda un poco más: descarga cinco años de historia.';
  });

  const toggleSchedule = (enabled: boolean) => act(async () => {
    await engine.setBulletinSchedule(office.id, { enabled, entidad, region });
    return enabled
      ? `Listo: cada vez que la DGE publique datos nuevos, la oficina generará el boletín${hasChats ? ' y lo enviará por Telegram' : ''}. El primero sale en la siguiente revisión (máximo una hora).`
      : 'Boletín automático desactivado.';
  });

  return (
    <div className="mt-4 p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 text-sm">
      <p className="font-semibold text-slate-800 flex items-center gap-2"><Landmark className="w-4 h-4 text-emerald-700" /> Con datos abiertos de la DGE (sin subir archivo)</p>
      <p className="text-xs text-slate-500 mt-1">
        Base nacional oficial de dengue, actualizada cada semana. El canal endémico y la comparación con años previos usan los cortes de la DGE de la misma fecha, para no confundir casos aún sin dictaminar con una baja real.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <label className="text-xs text-slate-600">Entidad
          <select value={entidad} onChange={(e) => setEntidad(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1 bg-white">
            <option value="">— elige —</option>
            {states.map(s => <option key={s.clave} value={s.clave}>{s.clave} · {s.nombre}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">Nombre del ámbito (título)
          <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Igual que la entidad"
                 className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1 bg-white" />
        </label>
      </div>
      {hasChats && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={telegram} onChange={(e) => setTelegram(e.target.checked)} />
          Enviar también a Telegram ({office.telegramChats!.map(c => c.title).join(', ')})
        </label>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={runNow} disabled={busy || !entidad}
                className="bg-emerald-700 text-white font-medium px-4 py-2 rounded-xl hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar ahora
        </button>
        {isOwner && (
          schedule?.enabled ? (
            <button onClick={() => toggleSchedule(false)} disabled={busy}
                    className="bg-white border border-slate-200 text-slate-700 font-medium px-4 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Desactivar boletín automático
            </button>
          ) : (
            <button onClick={() => toggleSchedule(true)} disabled={busy || !entidad}
                    className="bg-white border border-emerald-300 text-emerald-800 font-medium px-4 py-2 rounded-xl hover:bg-emerald-50 disabled:opacity-50 flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Activar boletín automático semanal
            </button>
          )
        )}
      </div>
      {schedule?.enabled && (
        <p className="mt-2 text-xs text-emerald-800">
          Automático activo para {schedule.region || schedule.entidad}
          {schedule.lastRunKey ? ` · último: SE ${schedule.lastRunKey.split('-')[1]}/${schedule.lastRunKey.split('-')[0]}` : ' · el primero sale en la siguiente revisión'}.
        </p>
      )}
      {!hasChats && isOwner && (
        <p className="mt-2 text-[11px] text-slate-500">Para recibirlo en Telegram, conecta un chat en Oficinas → Telegram.</p>
      )}
      {msg && (
        <p className={`mt-2 text-xs flex items-center gap-1 ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
          {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{msg.text}
        </p>
      )}
    </div>
  );
};
