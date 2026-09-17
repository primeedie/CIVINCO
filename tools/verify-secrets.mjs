import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', '.runtime', 'data', 'dist', 'node_modules', 'playwright-report', 'test-results', 'tmp']);
const allowed = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.yaml', '.yml', '.example', '.cmd']);
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name === '.env') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (allowed.has(path.extname(entry.name)) || entry.name === '.env.example') {
      const text = await readFile(full, 'utf8');
      const assigned = [...text.matchAll(/(?:GEMINI_API_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY)[ \t]*=[ \t]*([^\s#][^\r\n]*)/g)].map(match => match[1].trim()).filter(value => !/^(?:your_|example|replace|test-)/i.test(value));
      if (/(?:AIza[\w-]{20,}|AQ\.[\w-]{20,}|sb_secret_[\w-]{20,})/.test(text) || assigned.length) findings.push(path.relative(root, full));
    }
  }
}

await walk(root);
if (findings.length) {
  console.error(`Possible secret found in: ${findings.join(', ')}`);
  process.exitCode = 1;
} else console.log('Secret scan passed: no Gemini API key patterns found in publishable files.');
