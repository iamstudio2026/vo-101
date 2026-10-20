// "Download PDF": renders a deliverable as a clean printable document and opens the
// browser's print dialog, where "Save as PDF" produces the file. Printing real HTML keeps
// Markdown tables, headings and accents intact without bundling a PDF engine.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface PrintableDeliverable {
  title: string;
  body: string;
  worker?: string;
  office?: string;
  date?: string;
  model?: string;
  reviewVerdict?: string;
  approvedByUser?: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const REVIEW_LABEL: Record<string, string> = {
  approved: 'Revisión de calidad: aprobado',
  changes_requested: 'Revisión de calidad: con observaciones',
  unavailable: 'Revisión de calidad: no disponible',
};

export function buildPrintableHtml(d: PrintableDeliverable): string {
  const content = renderToStaticMarkup(createElement(Markdown, { remarkPlugins: [remarkGfm] }, d.body));
  const meta = [
    d.office && `Oficina: ${escapeHtml(d.office)}`,
    d.worker && `Elaborado por: ${escapeHtml(d.worker)}`,
    d.date && `Fecha: ${escapeHtml(d.date)}`,
    d.reviewVerdict && escapeHtml(REVIEW_LABEL[d.reviewVerdict] ?? d.reviewVerdict),
    d.approvedByUser && 'Aprobado por el responsable',
  ].filter(Boolean).join(' · ');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(d.title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font: 11pt/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1a1a2e; margin: 0; }
  header { border-bottom: 3px solid #1a8fc7; padding-bottom: 8px; margin-bottom: 16px; }
  header .brand { font-size: 8pt; letter-spacing: .15em; text-transform: uppercase; color: #64748b; }
  h1.title { font-size: 18pt; margin: 4px 0; }
  .meta { font-size: 8.5pt; color: #475569; }
  h1, h2, h3 { line-height: 1.25; } h2 { font-size: 14pt; } h3 { font-size: 12pt; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 9.5pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  code, pre { font-family: Consolas, monospace; font-size: 9pt; background: #f8fafc; }
  pre { padding: 8px; white-space: pre-wrap; }
  footer { margin-top: 24px; font-size: 7.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style></head>
<body>
  <header>
    <div class="brand">NEXUS · Virtual Office 101</div>
    <h1 class="title">${escapeHtml(d.title)}</h1>
    <div class="meta">${meta}</div>
  </header>
  <main>${content}</main>
  <footer>${d.model ? `Generado con ${escapeHtml(d.model)} · ` : ''}Exportado ${escapeHtml(new Date().toLocaleString('es-MX'))}</footer>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 150); });</script>
</body></html>`;
}

export function downloadDeliverablePdf(d: PrintableDeliverable): boolean {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Tu navegador bloqueó la ventana. Permite ventanas emergentes para este sitio y vuelve a intentar.');
    return false;
  }
  win.document.open();
  win.document.write(buildPrintableHtml(d));
  win.document.close();
  return true;
}
