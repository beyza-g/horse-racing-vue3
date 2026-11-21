// Fails when Turkish-specific letters appear in tracked source, tests or docs.
// Enforces the "English-only codebase" rule from CLAUDE.md.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'tests', 'scripts', 'public', 'docs'];
const ROOT_FILES = ['index.html', 'CLAUDE.md', 'README.md', 'package.json'];
const EXTENSIONS = new Set(['.ts', '.vue', '.js', '.mjs', '.json', '.css', '.html', '.md']);
// Built from code points so this file itself stays ASCII-only.
const FORBIDDEN_CODE_POINTS = [
  0xc7, 0xe7, 0x11e, 0x11f, 0x130, 0x131, 0xd6, 0xf6, 0x15e, 0x15f, 0xdc, 0xfc,
];
const FORBIDDEN = new RegExp(`[${String.fromCodePoint(...FORBIDDEN_CODE_POINTS)}]`, 'u');

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = [
  ...SCAN_DIRS.flatMap((dir) => {
    try {
      return walk(join(ROOT, dir));
    } catch {
      return [];
    }
  }),
  ...ROOT_FILES.map((file) => join(ROOT, file)).filter((file) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  }),
].filter((file) => EXTENSIONS.has(extname(file)));

const violations = [];
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (FORBIDDEN.test(line))
        violations.push(`${relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
    });
}

if (violations.length > 0) {
  console.error(`Non-English characters found (CLAUDE.md rule 1):\n${violations.join('\n')}`);
  process.exit(1);
}
console.warn(`English-only check passed (${files.length} files).`);
