import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv } from '../src/lib.js';

test('CSV: export → import round trip keeps commas, quotes, newlines and Thai text', () => {
  const rows = [
    { name: 'ชุดเทมเพลต "Pro", v2', price: 199.5, tags: ['notion', 'planner'], note: 'line 1\nline 2', empty: null },
    { name: 'plain', price: 49, tags: [], note: '', empty: undefined },
  ];
  const csv = toCsv(rows, ['name', 'price', 'tags', 'note', 'empty']);
  assert.deepEqual(parseCsv(csv), [
    ['name', 'price', 'tags', 'note', 'empty'],
    ['ชุดเทมเพลต "Pro", v2', '199.5', 'notion|planner', 'line 1\nline 2', ''],
    ['plain', '49', '', '', ''],
  ]);
});

test('CSV: parser handles LF/CRLF, blank lines and a missing trailing newline', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\r\n\r\n3,"x,y"'), [['a', 'b'], ['1', '2'], ['3', 'x,y']]);
  assert.deepEqual(parseCsv(''), []);
});

test('CSV: text that a spreadsheet would run as a formula is neutralised, numbers are not', () => {
  const [, row] = parseCsv(toCsv([{ a: '=HYPERLINK("http://x")', b: -5 }], ['a', 'b']));
  assert.deepEqual(row, [`'=HYPERLINK("http://x")`, '-5']);
});
