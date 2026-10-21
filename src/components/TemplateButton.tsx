import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Office } from '../types';
import * as engine from '../services/engine';

const SKILL_NAMES: Record<string, string> = {
  boletin_epidemiologico: 'Boletín epidemiológico',
  revision_evidencia: 'Revisión de evidencia',
};
const skillNames = (ids: string[]) => ids.map(id => SKILL_NAMES[id] ?? id).join(', ');

// Owner only: equip the office with the "Inteligencia sanitaria" team, context and skills.
export const TemplateButton: React.FC<{ office: Office }> = ({ office }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const applied = office.template === 'inteligencia_sanitaria';

  const apply = async () => {
    setBusy(true);
    setNote(null);
    try {
      const r = await engine.applyTemplate(office.id, 'inteligencia_sanitaria');
      setNote(r.workers_created.length
        ? `Listo: se sumaron ${r.workers_created.join(', ')}${r.note_added ? ' y la nota SINAVE' : ''}. Habilidades activas: ${skillNames(r.skills)}.`
        : 'La oficina ya tenía el equipo de la plantilla; solo se aseguraron la nota y la habilidad.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'No se pudo aplicar la plantilla.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        onClick={apply}
        disabled={busy}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1 disabled:opacity-50"
        title="Agrega 4 workers (Epidemióloga, Analista de datos, Revisora de evidencia, Redactor técnico), la nota SINAVE y las habilidades Boletín epidemiológico y Revisión de evidencia"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {applied ? 'Plantilla «Inteligencia sanitaria» aplicada · volver a aplicar' : 'Aplicar plantilla «Inteligencia sanitaria»'}
      </button>
      {note && <p className="mt-1 text-xs text-slate-600">{note}</p>}
    </div>
  );
};
