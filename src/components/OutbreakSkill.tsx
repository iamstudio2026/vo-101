import React, { useState } from 'react';
import { Activity, Upload, Loader2, AlertTriangle, CheckCircle2, Sparkles, X } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';

const ROLE_ORDER = ['fecha_inicio', 'hora_inicio', 'caso', 'sexo', 'edad', 'lugar', 'fecha_exposicion', 'hora_exposicion'];

// Skill «Análisis de brote»: upload the line list, say which column marks a case and which
// ones are exposures (foods, places…). Curve, attack rates and RR / Fisher come from the engine.
export const OutbreakSkill: React.FC<{ office: Office; onClose: () => void }> = ({ office, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [info, setInfo] = useState<engine.OutbreakInspection | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [exposures, setExposures] = useState<string[]>([]);
  const [evento, setEvento] = useState('');
  const [lugar, setLugar] = useState('');
  const [expuestos, setExpuestos] = useState<number | ''>('');
  const [comun, setComun] = useState('');
  const [contexto, setContexto] = useState('');

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await engine.inspectOutbreakFile(office.id, file);
      setInfo(r);
      setMapping(r.detected);
      setExposures(r.suggested_exposures);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!info) return;
    setBusy(true);
    setError(null);
    try {
      await engine.runOutbreak({
        office_id: office.id,
        upload_id: info.upload_id,
        mapping,
        params: {
          evento: evento.trim(), lugar: lugar.trim(), expuestos: expuestos || undefined,
          exposicion_comun: comun, exposiciones: mapping.caso ? exposures : [], contexto: contexto.trim(),
        },
      });
      setDone('Análisis en marcha: el analista procesa el listado y la epidemióloga lo interpreta. Lo verás en esta lista y en la oficina.');
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el análisis.');
    } finally {
      setBusy(false);
    }
  };

  const used = new Set(Object.values(mapping).filter(Boolean));
  const toggle = (c: string) => setExposures(x => (x.includes(c) ? x.filter(y => y !== c) : [...x, c]));

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Habilidad: Análisis de brote</h2>
            <p className="text-xs text-slate-500">Sube el listado nominal (CSV): curva epidémica, tasas de ataque y riesgo relativo por exposición.</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>

      <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-5 cursor-pointer text-sm ${busy ? 'opacity-60' : 'hover:border-indigo-300 hover:bg-indigo-50/40'} border-slate-200 text-slate-600`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {info ? `${info.filename} · ${info.rows.toLocaleString('es-MX')} personas · cambiar archivo` : 'Seleccionar listado nominal (CSV)'}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy}
               onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <p className="mt-2 text-[11px] text-slate-400">
        Si el listado incluye a todas las personas expuestas (casos y no casos, como en un cuestionario de alimentos), indica la columna «¿Es caso?» para obtener tasas de ataque por grupo y por exposición.
      </p>

      {error && <p className="mt-3 text-sm text-rose-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
      {done && <p className="mt-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{done}</p>}

      {info && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">1. Columnas del listado</h3>
            {info.date_range && (
              <p className="text-xs text-slate-500 mb-2">Inicio de síntomas: {info.date_range[0]} a {info.date_range[1]}</p>
            )}
            <div className="space-y-2">
              {ROLE_ORDER.map(role => (
                <label key={role} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">{info.role_labels[role]}{role === 'fecha_inicio' && <span className="text-rose-500"> *</span>}</span>
                  <select value={mapping[role] ?? ''}
                          onChange={(e) => setMapping({ ...mapping, [role]: e.target.value || null })}
                          className="w-56 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    <option value="">— no usar —</option>
                    {info.columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <h3 className="font-semibold text-slate-800 mt-5 mb-2">2. Exposiciones a comparar</h3>
            {!mapping.caso ? (
              <p className="text-xs text-slate-500">Sin columna «¿Es caso?» no hay no casos con quién comparar: el informe describirá los casos y la tasa de ataque global.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {info.columns.filter(c => !used.has(c)).map(c => (
                  <button key={c} type="button" onClick={() => toggle(c)}
                          className={`text-xs rounded-full px-2.5 py-1 border ${exposures.includes(c) ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-500'}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-2">3. El evento</h3>
            <div className="space-y-2">
              <label className="block text-xs text-slate-600">Nombre del evento *
                <input value={evento} onChange={(e) => setEvento(e.target.value)} placeholder="Intoxicación alimentaria en boda"
                       className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
              </label>
              <label className="block text-xs text-slate-600">Lugar
                <input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Salón de eventos, Cd. Victoria"
                       className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
              </label>
              {!mapping.caso && (
                <label className="block text-xs text-slate-600">Personas expuestas (para la tasa de ataque)
                  <input type="number" min={1} value={expuestos} onChange={(e) => setExpuestos(e.target.value ? Number(e.target.value) : '')}
                         className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
                </label>
              )}
              {!mapping.fecha_exposicion && (
                <label className="block text-xs text-slate-600">Exposición común (fecha y hora, si la hubo: comida, evento)
                  <input type="datetime-local" value={comun} onChange={(e) => setComun(e.target.value)}
                         className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
                </label>
              )}
              <label className="block text-xs text-slate-600">Contexto para la epidemióloga (opcional)
                <textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={3}
                          placeholder="Qué se sirvió, síntomas predominantes, muestras tomadas…"
                          className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
              </label>
            </div>
            <button onClick={generate} disabled={busy || !mapping.fecha_inicio || evento.trim().length < 3}
                    className="mt-5 w-full bg-indigo-600 text-white font-medium py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Analizar brote
            </button>
            <p className="mt-2 text-[11px] text-slate-400">
              Las cifras (curva, tasas de ataque, RR con IC 95 % y p de Fisher) las calcula el motor; el texto se verifica contra ellas. Una asociación no prueba la fuente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
