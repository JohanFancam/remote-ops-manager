#!/usr/bin/env node
/**
 * Remap light zinc/teal utility classes to a modern dark palette.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('src');
const EXT = new Set(['.jsx', '.js', '.tsx', '.ts']);
const COLORED_BG =
  /\bbg-(?:teal|blue|emerald|green|red|orange|amber|yellow|rose|indigo|sky|cyan)-\d{2,3}\b/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'ui') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(entry.name))) out.push(p);
  }
  return out;
}

function remap(s) {
  // Placeholders for muted text so 400/500 don't thrash
  s = s.replace(/\btext-zinc-500\b/g, '__MUTED_A__');
  s = s.replace(/\btext-zinc-400\b/g, '__MUTED_B__');

  const pairs = [
    ['bg-zinc-100/60', 'bg-zinc-800/60'],
    ['bg-zinc-100', 'bg-zinc-800'],
    ['bg-white/90', 'bg-zinc-950/90'],
    ['bg-white/70', 'bg-zinc-900/70'],
    ['bg-white', 'bg-zinc-900'],
    ['hover:bg-zinc-100', 'hover:bg-zinc-800'],
    ['hover:bg-zinc-200/70', 'hover:bg-zinc-800'],
    ['hover:bg-zinc-200', 'hover:bg-zinc-700'],
    ['bg-zinc-200', 'bg-zinc-700'],
    ['border-zinc-200/80', 'border-zinc-800/80'],
    ['border-zinc-200', 'border-zinc-800'],
    ['border-zinc-100', 'border-zinc-800'],
    ['border-zinc-300', 'border-zinc-700'],
    ['text-zinc-900', 'text-zinc-100'],
    ['hover:text-zinc-900', 'hover:text-zinc-50'],
    ['hover:text-zinc-700', 'hover:text-zinc-200'],
    ['hover:text-zinc-600', 'hover:text-zinc-300'],
    ['text-zinc-700', 'text-zinc-300'],
    ['text-zinc-600', 'text-zinc-400'],
    ['bg-teal-50', 'bg-teal-950/40'],
    ['text-teal-800', 'text-teal-300'],
    ['text-teal-700', 'text-teal-400'],
    ['hover:text-teal-800', 'hover:text-teal-300'],
    ['border-teal-200', 'border-teal-800'],
    ['bg-teal-700', 'bg-teal-600'],
    ['hover:bg-teal-800', 'hover:bg-teal-500'],
    ['border-t-teal-700', 'border-t-teal-400'],
    ['border-teal-700', 'border-teal-500'],
    ['ring-teal-700/25', 'ring-teal-500/30'],
    ['ring-teal-600/40', 'ring-teal-500/30'],
    ['focus:border-teal-700/40', 'focus:border-teal-500/40'],
    ['focus:ring-teal-600', 'focus:ring-teal-500'],
    ['bg-amber-50', 'bg-amber-950/40'],
    ['text-amber-800', 'text-amber-300'],
    ['text-amber-700', 'text-amber-400'],
    ['text-amber-600', 'text-amber-400'],
    ['border-amber-200', 'border-amber-800'],
    ['bg-emerald-50', 'bg-emerald-950/40'],
    ['text-emerald-800', 'text-emerald-300'],
    ['text-emerald-700', 'text-emerald-400'],
    ['border-emerald-200', 'border-emerald-800'],
    ['bg-red-50', 'bg-red-950/40'],
    ['text-red-700', 'text-red-400'],
    ['text-red-600', 'text-red-400'],
    ['border-red-200', 'border-red-800'],
    ['placeholder:text-zinc-400', 'placeholder:text-zinc-600'],
    ['bg-[#eef3f1]', 'bg-zinc-900'],
    ['bg-[#f3f2ef]', 'bg-zinc-950'],
  ];

  for (const [a, b] of pairs) s = s.split(a).join(b);

  s = s.replace(/__MUTED_A__/g, 'text-zinc-400');
  s = s.replace(/__MUTED_B__/g, 'text-zinc-500');
  return s;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  let after = remap(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log('updated', path.relative(process.cwd(), file));
  }
}
console.log(`Done. ${changed}/${files.length} files changed.`);
