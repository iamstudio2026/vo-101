import React, { useState } from 'react';
import { FileSignature, Loader2, AlertTriangle, CheckCircle2, Sparkles, X, Upload, Trash2 } from 'lucide-react';
import { Office, Task } from '../types';
import * as engine from '../services/engine';

const TYPES: { id: engine.DocType; label: string; hint: string }[] = [
  { id: 'oficio', label: 'Oficio', hint: 'Comunicación formal a otra área o institución.' },
  { id: 'nota_informativa', label: 'Nota informativa', hint: 'Para informar a un superior: antecedentes, situación, acciones.' },
  { id: 'informe_tecnico', label: 'Informe técnico', hint: 'Documento extenso con resultados y recomendaciones.' },
];
const SOURCE_SKILLS = new Set(['boletin_epidemiologico', 'revision_evidencia', 'analisis_brote']);

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; className?: string }> =
  ({ label, value, onChange, placeholder, rows, className }) => (
    <label className={`block text-xs text-slate-600 ${className ?? ''}`}>{label}
      {rows ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
               className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1" />
      )}
    </label>
  );

// Skill «Documento institucional»: the writer drafts only the body; letterhead, number, date,
// addressee, signature and c.c.p. come from these fields, so nothing official is invented.
export const DocumentSkill: React.FC<{ office: Office; tasks: Task[]; isOwner: boolean; onClose: () => void }> =
  ({ office, tasks, isOwner, onClose }) => {
    const saved = (office.skillSettings?.documento_institucional ?? {}) as Partial<engine.DocHeader>;
    const [tipo, setTipo] = useState<engine.DocType>('oficio');
    const [h, setH] = useState<engine.DocHeader>({
      dependencia: saved.dependencia ?? '', area: saved.area ?? '', numero: '', lugar: saved.lugar ?? '', asunto: '',
      destinatario: { nombre: '', cargo: '', institucion: '' },
      remitente: { nombre: saved.remitente?.nombre ?? '', cargo: saved.remitente?.cargo ?? '' },
      ccp: saved.ccp ?? [],
    });
    const [instrucciones, setInstrucciones] = useState('');
    const [source, setSource] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const sources = tasks.filter(t => t.result && t.status === 'done' && (SOURCE_SKILLS.has(t.skill ?? '') || !t.skill))
      .sort((a, b) => (b.executedAt ?? b.createdAt).localeCompare(a.executedAt ?? a.createdAt)).slice(0, 30);

    const run = async () => {
      setBusy(true);
      setError(null);
      setDone(null);
      try {
        await engine.runDocument({ office_id: office.id, tipo, encabezado: h, instrucciones, source_task_id: source || undefined });
        setDone('El redactor ya está trabajando en el documento. Cuando esté listo, descárgalo en Word desde la oficina.');
        setInstrucciones('');
        setH({ ...h, numero: '', asunto: '' });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar el documento.');
      } finally {
        setBusy(false);
      }
    };

    const onTemplate = async (file?: File) => {
      if (!file) return;
      setBusy(true);
      setError(null);
      try {
        await engine.uploadDocTemplate(office.id, file);
        setDone(`Plantilla «${file.name}» guardada: los documentos y descargas en Word usarán su membrete.`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo guardar la plantilla.');
      } finally {
        setBusy(false);
      }
    };

    const removeTemplate = async () => {
      setBusy(true);
      try {
        await engine.deleteDocTemplate(office.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo quitar la plantilla.');
      } finally {
        setBusy(false);
      }
    };

    const person = (key: 'destinatario' | 'remitente', field: keyof engine.DocPerson) => (v: string) =>
      setH({ ...h, [key]: { ...h[key], [field]: v } });

    return (
      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Habilidad: Documento institucional</h2>
              <p className="text-xs text-slate-500">Oficio, nota informativa o informe técnico en Word. La IA redacta el cuerpo; los datos oficiales los pones tú.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setTipo(t.id)} title={t.hint}
                    className={`text-sm rounded-xl px-3 py-1.5 border ${tipo === t.id ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">Datos del documento</h3>
            {!office.docTemplate && (
              <Field label="Membrete (una línea por renglón; si subes plantilla de Word se usa la suya)" rows={2}
                     value={h.dependencia} onChange={(v) => setH({ ...h, dependencia: v })}
                     placeholder={'Secretaría de Salud de Tamaulipas\nDirección de Epidemiología'} />
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Área que emite" value={h.area} onChange={(v) => setH({ ...h, area: v })} />
              {tipo === 'oficio'
                ? <Field label="Número de oficio" value={h.numero} onChange={(v) => setH({ ...h, numero: v })} placeholder="DE/123/2026" />
                : <span />}
              <Field label="Lugar" value={h.lugar} onChange={(v) => setH({ ...h, lugar: v })} placeholder="Cd. Victoria, Tamaulipas" />
              <Field label="Asunto *" value={h.asunto} onChange={(v) => setH({ ...h, asunto: v })} />
            </div>
            {tipo !== 'informe_tecnico' && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Destinatario: nombre" value={h.destinatario.nombre} onChange={person('destinatario', 'nombre')} />
                <Field label="Destinatario: cargo" value={h.destinatario.cargo} onChange={person('destinatario', 'cargo')} />
                <Field label="Destinatario: institución" className="col-span-2" value={h.destinatario.institucion ?? ''}
                       onChange={person('destinatario', 'institucion')} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Field label={tipo === 'informe_tecnico' ? 'Elaboró: nombre' : 'Firma: nombre'} value={h.remitente.nombre} onChange={person('remitente', 'nombre')} />
              <Field label="Cargo" value={h.remitente.cargo} onChange={person('remitente', 'cargo')} />
            </div>
            {tipo !== 'informe_tecnico' && (
              <Field label="c.c.p. (uno por renglón)" rows={2} value={h.ccp.join('\n')}
                     onChange={(v) => setH({ ...h, ccp: v.split('\n').slice(0, 10) })} />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">¿Qué debe decir?</h3>
            <Field label="Instrucciones para el redactor *" rows={5} value={instrucciones} onChange={setInstrucciones}
                   placeholder="Informar la situación de dengue de la SE 41 y solicitar a la Jurisdicción reforzar el control larvario en las colonias con más casos." />
            <label className="block text-xs text-slate-600">Basado en un entregable de la oficina (opcional; sus cifras son las únicas permitidas)
              <select value={source} onChange={(e) => setSource(e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-1">
                <option value="">— ninguno —</option>
                {sources.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            <button onClick={run} disabled={busy || h.asunto.trim().length < 3 || instrucciones.trim().length < 10}
                    className="mt-3 w-full bg-indigo-600 text-white font-medium py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Redactar {TYPES.find(t => t.id === tipo)?.label.toLowerCase()}
            </button>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-semibold text-slate-700">Plantilla de Word de la oficina</p>
              {office.docTemplate ? (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  {office.docTemplate.filename}: los documentos se arman sobre su membrete.
                  {isOwner && (
                    <button onClick={removeTemplate} disabled={busy} className="text-rose-600 hover:text-rose-700" title="Quitar plantilla">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">Sin plantilla: se usa un formato limpio con el membrete en texto.</p>
              )}
              {isOwner && (
                <label className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-700 cursor-pointer hover:underline">
                  <Upload className="w-3.5 h-3.5" /> {office.docTemplate ? 'Reemplazar plantilla (.docx)' : 'Subir plantilla con membrete (.docx)'}
                  <input type="file" accept=".docx" className="hidden" disabled={busy} onChange={(e) => onTemplate(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
        {done && <p className="mt-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{done}</p>}
      </div>
    );
  };
