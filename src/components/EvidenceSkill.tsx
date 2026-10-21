import React, { useState } from 'react';
import { BookOpenCheck, Loader2, Sparkles, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';

const EXAMPLES = [
  '¿Qué tan efectiva es la fumigación espacial (ULV) para reducir la transmisión de dengue?',
  '¿Qué factores de riesgo se asocian con dengue grave en adultos?',
  '¿La participación comunitaria en la eliminación de criaderos reduce la incidencia de dengue?',
];

// Skill «Revisión de evidencia»: a health question becomes a PubMed search run by the
// engine, a screening of the candidates, and a synthesis whose every citation is checked.
export const EvidenceSkill: React.FC<{ office: Office; onClose: () => void }> = ({ office, onClose }) => {
  const [question, setQuestion] = useState('');
  const [years, setYears] = useState(10);
  const [maxArticles, setMaxArticles] = useState(12);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await engine.runEvidenceReview(office.id, question.trim(), years, maxArticles);
      setDone('Revisión en marcha: la revisora está buscando en PubMed. La verás en esta lista y en la oficina.');
      setQuestion('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar la revisión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpenCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Habilidad: Revisión de evidencia</h2>
            <p className="text-xs text-slate-500">Busca en PubMed, criba los estudios pertinentes y sintetiza con citas verificables.</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        placeholder="Escribe una pregunta concreta de salud (población, intervención o exposición, desenlace)…"
        className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500"
      />
      <div className="flex flex-wrap gap-2 mt-2">
        {EXAMPLES.map(ex => (
          <button key={ex} onClick={() => setQuestion(ex)}
                  className="text-[11px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-full px-2.5 py-1">
            {ex}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-4 mt-4 text-sm">
        <label className="text-xs text-slate-600">Periodo
          <select value={years} onChange={(e) => setYears(Number(e.target.value))}
                  className="block mt-1 border border-slate-200 rounded-lg px-2 py-1">
            <option value={5}>Últimos 5 años</option>
            <option value={10}>Últimos 10 años</option>
            <option value={20}>Últimos 20 años</option>
          </select>
        </label>
        <label className="text-xs text-slate-600">Máximo de estudios
          <select value={maxArticles} onChange={(e) => setMaxArticles(Number(e.target.value))}
                  className="block mt-1 border border-slate-200 rounded-lg px-2 py-1">
            <option value={8}>8</option>
            <option value={12}>12</option>
            <option value={20}>20</option>
          </select>
        </label>
        <button
          onClick={run}
          disabled={busy || question.trim().length < 10}
          className="ml-auto bg-indigo-600 text-white font-medium px-5 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Buscar evidencia
        </button>
      </div>
      {done && <p className="mt-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{done}</p>}
      {error && <p className="mt-3 text-sm text-rose-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
      <p className="mt-3 text-[11px] text-slate-400">
        La síntesis se basa en los resúmenes de PubMed, no en el texto completo. Cada cita enlaza al artículo y la cadena de búsqueda queda en el entregable.
      </p>
    </div>
  );
};
