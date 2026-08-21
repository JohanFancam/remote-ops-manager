#!/usr/bin/env node
/**
 * Remap hardcoded dark Tailwind classes to a light, modern palette.
 * Skips colored solid buttons/badges so their text-white stays readable.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('src');
const EXT = new Set(['.jsx', '.js', '.tsx', '.ts', '.css']);

const COLORED_BG =
  /\bbg-(?:blue|teal|emerald|green|red|orange|amber|yellow|rose|indigo|violet|purple|sky|cyan|lime|fuchsia|pink)-\d{2,3}\b/;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'ui') continue; // leave shadcn primitives alone
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (EXT.has(path.extname(entry.name))) out.push(p);
  }
  return out;
}

function remapClassChunk(chunk) {
  let s = chunk;

  // Surfaces / canvas
  s = s.replaceAll('bg-gray-950', 'bg-zinc-100');
  s = s.replaceAll('bg-slate-950', 'bg-zinc-100');
  s = s.replaceAll('bg-slate-900', 'bg-white');
  s = s.replaceAll('bg-gray-900/80', 'bg-white');
  s = s.replaceAll('bg-gray-900/70', 'bg-white');
  s = s.replaceAll('bg-gray-900/60', 'bg-white');
  s = s.replaceAll('bg-gray-900/50', 'bg-white');
  s = s.replaceAll('bg-gray-900', 'bg-white');
  s = s.replaceAll('bg-gray-800/80', 'bg-zinc-100');
  s = s.replaceAll('bg-gray-800/50', 'bg-zinc-50');
  s = s.replaceAll('bg-gray-800', 'bg-zinc-100');
  s = s.replaceAll('bg-gray-700', 'bg-zinc-200');
  s = s.replaceAll('hover:bg-gray-800', 'hover:bg-zinc-100');
  s = s.replaceAll('hover:bg-gray-700', 'hover:bg-zinc-200');

  // Borders
  s = s.replaceAll('border-gray-800/80', 'border-zinc-200');
  s = s.replaceAll('border-gray-800', 'border-zinc-200');
  s = s.replaceAll('border-gray-700/70', 'border-zinc-200');
  s = s.replaceAll('border-gray-700', 'border-zinc-200');
  s = s.replaceAll('border-slate-700/60', 'border-zinc-200');
  s = s.replaceAll('border-slate-700', 'border-zinc-200');
  s = s.replaceAll('border-slate-800', 'border-zinc-200');

  // Text
  s = s.replaceAll('text-gray-300', 'text-zinc-600');
  s = s.replaceAll('text-gray-400', 'text-zinc-500');
  s = s.replaceAll('text-gray-500', 'text-zinc-400');
  s = s.replaceAll('text-slate-400', 'text-zinc-500');
  s = s.replaceAll('text-slate-500', 'text-zinc-400');
  s = s.replaceAll('text-slate-600', 'text-zinc-400');
  s = s.replaceAll('hover:text-white', 'hover:text-zinc-900');
  s = s.replaceAll('hover:text-gray-300', 'hover:text-zinc-700');

  // Accents (blue → teal)
  s = s.replaceAll('bg-blue-600/20', 'bg-teal-50');
  s = s.replaceAll('bg-blue-600', 'bg-teal-700');
  s = s.replaceAll('bg-blue-500', 'bg-teal-600');
  s = s.replaceAll('hover:bg-blue-500', 'hover:bg-teal-600');
  s = s.replaceAll('hover:bg-blue-600', 'hover:bg-teal-800');
  s = s.replaceAll('text-blue-400', 'text-teal-700');
  s = s.replaceAll('text-blue-300', 'text-teal-700');
  s = s.replaceAll('hover:text-blue-300', 'hover:text-teal-800');
  s = s.replaceAll('hover:text-blue-400', 'hover:text-teal-800');
  s = s.replaceAll('border-blue-500/30', 'border-teal-200');
  s = s.replaceAll('border-blue-800/50', 'border-teal-200');
  s = s.replaceAll('border-t-blue-500', 'border-t-teal-600');
  s = s.replaceAll('border-blue-600', 'border-teal-700');
  s = s.replaceAll('ring-blue-500/50', 'ring-teal-600/40');
  s = s.replaceAll('focus:ring-blue-500', 'focus:ring-teal-600');
  s = s.replaceAll('bg-blue-950/40', 'bg-teal-50');
  s = s.replaceAll('from-slate-950', 'from-zinc-100');
  s = s.replaceAll('via-slate-900', 'via-white');
  s = s.replaceAll('to-blue-950', 'to-teal-50');

  // Status soft backgrounds
  s = s.replaceAll('bg-yellow-950/30', 'bg-amber-50');
  s = s.replaceAll('bg-yellow-600/20', 'bg-amber-50');
  s = s.replaceAll('text-yellow-400', 'text-amber-700');
  s = s.replaceAll('text-yellow-300', 'text-amber-700');
  s = s.replaceAll('border-yellow-800/40', 'border-amber-200');
  s = s.replaceAll('bg-green-600/20', 'bg-emerald-50');
  s = s.replaceAll('text-green-400', 'text-emerald-700');
  s = s.replaceAll('bg-red-500/10', 'bg-red-50');
  s = s.replaceAll('text-red-300', 'text-red-700');
  s = s.replaceAll('border-red-500/30', 'border-red-200');
  s = s.replaceAll('text-red-400', 'text-red-600');

  // text-white → ink unless this chunk already has a solid colored background
  if (!COLORED_BG.test(s) && !/\bbg-teal-\d/.test(s)) {
    s = s.replace(/\btext-white\b/g, 'text-zinc-900');
  }

  return s;
}

function transform(source) {
  // Transform className={"..."} and className="..." and template literals carefully
  // by rewriting common tokens globally — tokens are unique enough.
  let out = remapClassChunk(source);

  // Fix double-remapped hover tokens that got partially replaced earlier
  out = out.replaceAll('hover:bg-zinc-100', 'hover:bg-zinc-100');
  out = out.replaceAll('hover:bg-zinc-100', 'hover:bg-zinc-100');

  // placeholder colors
  out = out.replaceAll('placeholder:text-slate-600', 'placeholder:text-zinc-400');
  out = out.replaceAll('placeholder:text-zinc-600', 'placeholder:text-zinc-400');

  return out;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed++;
    console.log('updated', path.relative(process.cwd(), file));
  }
}
console.log(`Done. ${changed}/${files.length} files changed.`);
