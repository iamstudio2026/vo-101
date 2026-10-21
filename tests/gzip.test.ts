import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { gzipBase64 } from '../src/lib/gzip.ts';

test('the browser upload helper produces base64 gzip that round-trips exactly', async () => {
  const csv = 'FECHA_SIGN_SINTOMAS,ESTATUS_CASO\n' + Array.from({ length: 5000 }, (_, i) => `2026-01-0${(i % 9) + 1},${(i % 3) + 1}`).join('\n');
  const b64 = await gzipBase64(new Blob([csv]));
  const back = gunzipSync(Buffer.from(b64, 'base64')).toString('utf-8');
  assert.equal(back, csv);
  assert.ok(b64.length < csv.length / 3, 'CSV should compress well');
});
