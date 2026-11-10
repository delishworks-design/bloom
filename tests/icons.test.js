const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('index.html contains no "<pathd" typo', () => {
  assert.strictEqual((html.match(/<pathd/g) || []).length, 0);
});

test('every IC icon has valid, well-formed SVG markup', () => {
  // Pull out the SVG helper + IC object from index.html and evaluate only that part.
  const m = html.match(/const SVG=[\s\S]*?\nconst GLASSPATH/);
  assert.ok(m, 'Could not find SVG helper and IC object in index.html');
  const code = m[0].replace('const GLASSPATH', '').replace(/const /g, 'var ');
  const IC = new Function(code + '; return IC;')();

  const keys = Object.keys(IC);
  assert.ok(keys.length >= 40, 'Expected at least 40 icons, found ' + keys.length);

  const problems = [];
  for (const k of keys) {
    const svg = IC[k](24);
    if (!/^<svg[\s\S]*<\/svg>$/.test(svg)) problems.push(k + ': not wrapped in <svg>');
    const tags = svg.match(/<[a-zA-Z]+/g) || [];
    for (const t of tags) {
      if (!['<svg', '<path', '<circle', '<rect', '<line', '<polyline', '<polygon', '<ellipse'].includes(t)) {
        problems.push(k + ': unexpected tag ' + t);
      }
    }
    const pathCount = (svg.match(/<path/g) || []).length;
    const pathWithD = (svg.match(/<path d="[^"]+"/g) || []).length;
    if (pathCount !== pathWithD) problems.push(k + ': a <path> is missing its d attribute');
    // Path data must never contain a letter glued to a bare "d" attribute or be empty.
    if (/<path d=""/.test(svg)) problems.push(k + ': empty path data');
  }
  assert.deepStrictEqual(problems, []);
});