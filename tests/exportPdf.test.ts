import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrintableHtml } from '../src/lib/exportPdf.ts';

test('markdown tables become real tables in the printable document', () => {
  const html = buildPrintableHtml({
    title: 'Calendario SE 2026',
    body: '| SE | Inicio | Fin |\n|---|---|---|\n| 1 | 04-01-2026 | 10-01-2026 |',
  });
  assert.match(html, /<table>/);
  assert.match(html, /<td>04-01-2026<\/td>/);
  assert.match(html, /window\.print\(\)/);
});

test('metadata is shown and user text is escaped', () => {
  const html = buildPrintableHtml({
    title: '<script>alert(1)</script> Informe',
    body: 'Hola',
    worker: 'Marc',
    office: 'SNSP',
    reviewVerdict: 'approved',
    approvedByUser: true,
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; Informe/);
  assert.match(html, /Elaborado por: Marc/);
  assert.match(html, /Revisión de calidad: aprobado/);
  assert.match(html, /Aprobado por el responsable/);
});

test('markdown inside the deliverable cannot inject script tags', () => {
  const html = buildPrintableHtml({ title: 't', body: 'texto <script>alert(2)</script> fin' });
  assert.ok(!html.includes('alert(2)</script>'));
});
