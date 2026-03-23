#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

// Usage: run after `npm run build`.
// This script reads the `dist` directory produced by Vite and inlines CSS/JS into a single `portable.html`.

const distDir = path.resolve(process.cwd(), 'dist');
const outFile = path.resolve(process.cwd(), 'portable.html');

async function readFileIfExists(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

async function main() {
  const indexHtmlPath = path.join(distDir, 'index.html');
  const indexHtml = await readFileIfExists(indexHtmlPath);
  if (!indexHtml) {
    console.error('dist/index.html not found — run `npm run build` first');
    process.exit(1);
  }

  // Find linked CSS and JS files in dist
  // A simple regex approach: replace <link rel="stylesheet" href="/assets/...css"> and <script type="module" src="/assets/...js"></script>
  let out = indexHtml;

  // Inline styles
  const cssLinkRegex = /<link[^>]+href="([^"]+\.css)"[^>]*>/g;
  out = await replaceAsync(out, cssLinkRegex, async (m, href) => {
    const filePath = path.join(distDir, href.replace(/^\//, ''));
    const css = await readFileIfExists(filePath) || '';
    return `<style>\n${css}\n</style>`;
  });

  // Inline scripts
  const scriptRegex = /<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g;
  out = await replaceAsync(out, scriptRegex, async (m, src) => {
    const filePath = path.join(distDir, src.replace(/^\//, ''));
    const js = await readFileIfExists(filePath) || '';
    return `<script>\n${js}\n</script>`;
  });

  // Write portable.html
  await fs.writeFile(outFile, out, 'utf8');
  console.log('portable.html created at', outFile);
}

async function replaceAsync(str, regex, asyncFn) {
  const matches = [];
  str.replace(regex, (m, ...args) => { matches.push([m, args.slice(0, -2)]); return m; });
  let result = str;
  for (const [m, groups] of matches) {
    const replacement = await asyncFn(m, ...groups);
    result = result.replace(m, replacement);
  }
  return result;
}

main().catch(err => { console.error(err); process.exit(1); });
