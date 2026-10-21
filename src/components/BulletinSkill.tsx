import React, { useState } from 'react';
import { FileSpreadsheet, Upload, Loader2, AlertTriangle, CheckCircle2, Sparkles, X, Users } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';
import { DgeBulletin } from './DgeBulletin';

const ROLE_ORDER = ['fecha_sintomas', 'estatus', 'municipio', 'jurisdiccion', 'edad', 'sexo', 'entidad', 'gravedad'];
const REQUIRED = new Set(['fecha_sintomas', 'estatus']);
const CLASS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado', probable: 'Probable', descartado: 'Descartado', ignorar: 'No contar',
};

// Rates need a denominator: the office keeps one population table (e.g. CONAPO projections).
const PopulationPanel: React.FC<{ office: Office }> = ({ office }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const pop = office.population;

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await engine.uploadPopulation(office.id, file);
      setMsg(`Población cargada: ${r.municipios} municipios${r.years.length ? `, años ${r.years.join(', ')}` : ''}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo leer la tabla de población.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
      <Users className="w-4 h-4 text-slate-400" />
      {pop
        ? <span>Tasas por 100 000 hab. con <strong className="text-slate-700">{pop.filename}</strong> ({pop.municipios} municipios{pop.years.length ? `, ${pop.years.join(', ')}` : ''}).</span>
        : <span>Sin tabla de población: el boletín no incluirá tasas.</span>}
      <label className="inline-flex items-center gap-1 text-indigo-700 cursor-pointer hover:underline">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {pop ? 'Reemplazar' : 'Cargar población (CSV: municipio o clave, población, año opcional)'}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <span className="w-full text-[11px] text-slate-400">El canal endémico se agrega solo si el archivo de casos trae al menos 3 de los 5 años previos (lo ideal son 5).</span>
      {msg && <span className="w-full text-slate-600">{msg}</span>}
    </div>
  );
};

// Skill «Boletín epidemiológico»: upload the case CSV, confirm how its columns and status
// codes should be read, pick the week. The numbers are computed by the engine; the
// mapping is remembered for the office, so next week is: upload, check, generate.
export const BulletinSkill: React.FC<{ office: Office; isOwner: boolean; onClose: () => void }> = ({ office, isOwner, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [info, setInfo] = useState<engine.BulletinInspection | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [year, setYear] = useState<number | ''>('');
  const [week, setWeek] = useState<number | ''>('');
  const [region, setRegion] = useState(office.name);
  const [entidad, setEntidad] = useState('');

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await engine.inspectBulletinFile(office.id, file);
      const saved = r.saved_settings || {};
      const sameColumns = saved.mapping && Object.values(saved.mapping).every(c => !c || r.columns.includes(c));
      setInfo(r);
      setMapping(sameColumns ? { ...r.detected, ...saved.mapping } : r.detected);
      setStatusMap(Object.fromEntries(r.status_values.map(v => [v.value, saved.statusMap?.[v.value] ?? r.suggested_status[v.value] ?? 'ignorar'])));
      setYear(r.suggested_period?.year ?? '');
      setWeek(r.suggested_period?.week ?? '');
      setRegion(saved.region || office.name);
      setEntidad(saved.entidad ?? (r.entidad_values.length > 1 ? '' : ''));
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
      await engine.runBulletin({
        office_id: office.id,
        upload_id: info.upload_id,
        mapping,
        status_map: statusMap,
        params: { year: year || undefined, week: week || undefined, region, entidad },
        telegram: (office.telegramChats ?? []).length > 0,
      });
      setDone('Boletín en preparación. El analista ya lo está procesando: lo verás en esta lista y en la oficina.');
      setInfo(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el boletín.');
    } finally {
      setBusy(false);
    }
  };

  const missing = [...REQUIRED].filter(r => !mapping[r]);
  const hasConfirmed = Object.values(statusMap).includes('confirmado');

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Habilidad: Boletín epidemiológico</h2>
            <p className="text-xs text-slate-500">Sube la base de casos (CSV). Las cifras las calcula el motor; el texto se verifica contra ellas.</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>

      <DgeBulletin office={office} isOwner={isOwner} />

      <p className="mt-5 mb-2 text-sm font-semibold text-slate-800">O con tu propia base de casos (CSV)</p>
      <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl py-5 cursor-pointer text-sm ${busy ? 'opacity-60' : 'hover:border-indigo-300 hover:bg-indigo-50/40'} border-slate-200 text-slate-600`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {info ? `${info.filename} · ${info.rows.toLocaleString('es-MX')} registros · cambiar archivo` : 'Seleccionar CSV de casos'}
        <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy}
               onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      <PopulationPanel office={office} />

      {error && <p className="mt-3 text-sm text-rose-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
      {done && <p className="mt-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{done}</p>}

      {info && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">1. Columnas del archivo</h3>
            {info.date_range && (
              <p className="text-xs text-slate-500 mb-2">Fechas de inicio de síntomas: {info.date_range[0]} a {info.date_range[1]}</p>
            )}
            <div className="space-y-2">
              {ROLE_ORDER.map(role => (
                <label key={role} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">{info.role_labels[role]}{REQUIRED.has(role) && <span className="text-rose-500"> *</span>}</span>
                  <select
                    value={mapping[role] ?? ''}
                    onChange={(e) => setMapping({ ...mapping, [role]: e.target.value || null })}
                    className="w-56 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="">— no usar —</option>
                    {info.columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-800 mb-2">2. ¿Qué significa cada estatus?</h3>
            {info.status_values.length === 0 && <p className="text-xs text-slate-500">Elige la columna de estatus para ver sus valores.</p>}
            <div className="space-y-2">
              {info.status_values.map(v => (
                <label key={v.value} className="flex items-center justify-between gap-3">
                  <span className="text-slate-600"><code className="bg-slate-100 px-1 rounded">{v.value || '(vacío)'}</code> <span className="text-xs text-slate-400">{v.count.toLocaleString('es-MX')} registros</span></span>
                  <select value={statusMap[v.value] ?? 'ignorar'}
                          onChange={(e) => setStatusMap({ ...statusMap, [v.value]: e.target.value })}
                          className="w-40 border border-slate-200 rounded-lg px-2 py-1 text-xs">
                    {Object.entries(CLASS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {info.assumptions.map((a, i) => (
              <p key={i} className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />{a}
              </p>
            ))}

            <h3 className="font-semibold text-slate-800 mt-5 mb-2">3. Periodo y alcance</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">Año
                <input type="number" value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                       className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
              </label>
              <label className="text-xs text-slate-600">Semana epidemiológica
                <input type="number" min={1} max={53} value={week} onChange={(e) => setWeek(e.target.value ? Number(e.target.value) : '')}
                       className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
              </label>
              <label className="text-xs text-slate-600 col-span-2">Nombre del ámbito (aparece en el título)
                <input value={region} onChange={(e) => setRegion(e.target.value)}
                       className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
              </label>
              {mapping.entidad && info.entidad_values.length > 1 && (
                <label className="text-xs text-slate-600 col-span-2">Filtrar entidad de residencia
                  <select value={entidad} onChange={(e) => setEntidad(e.target.value)}
                          className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1">
                    <option value="">Todas</option>
                    {info.entidad_values.map(v => <option key={v.value} value={v.value}>{v.value} ({v.count.toLocaleString('es-MX')})</option>)}
                  </select>
                </label>
              )}
            </div>

            <button
              onClick={generate}
              disabled={busy || missing.length > 0 || !hasConfirmed}
              className="mt-5 w-full bg-indigo-600 text-white font-medium py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generar boletín
            </button>
            {(missing.length > 0 || !hasConfirmed) && (
              <p className="mt-2 text-xs text-slate-500">
                {missing.length > 0 ? 'Faltan columnas obligatorias (*). ' : ''}
                {!hasConfirmed ? 'Marca qué valor corresponde a casos confirmados.' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
