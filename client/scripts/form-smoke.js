/**
 * Form contract smoke test.
 *
 * The form library mixes two onChange conventions:
 *   - Input / Select / Textarea hand over the DOM event
 *   - Checkbox / Toggle / SearchInput hand over the plain value
 *
 * `fieldValue` (client/src/lib/form.js) accepts either. This test verifies
 * that helper and scans the pages for the two mistakes that break at runtime:
 *   1. a React hook used without importing it
 *   2. `onChange={update(...)}` on a value-passing control, in a file whose
 *      `update` helper does not normalise through `fieldValue`
 *
 * Run with: npm run smoke:forms   (from the client folder)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fieldValue } from '../src/lib/form.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..', 'src');

const failures = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  // eslint-disable-next-line no-console
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
}

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collect(full));
    else if (/\.jsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// eslint-disable-next-line no-console
console.log('\nfieldValue contract');
check('text input event', fieldValue({ target: { type: 'text', value: 'Cement' } }), 'Cement');
check('number input event', fieldValue({ target: { type: 'number', value: '12' } }), '12');
check('select event', fieldValue({ target: { type: 'select-one', value: 'abc' } }), 'abc');
check('checkbox event', fieldValue({ target: { type: 'checkbox', checked: true } }), true);
check('checkbox value true', fieldValue(true), true);
check('checkbox value false', fieldValue(false), false);
check('toggle value', fieldValue(true), true);
check('search input string', fieldValue('cement'), 'cement');

const HOOKS = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext'];
const VALUE_CONTROLS = ['Checkbox', 'Toggle', 'SearchInput'];
const files = collect(srcRoot);

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = file.replace(srcRoot, 'src');
  const lines = src.split('\n');

  const reactImport = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]react['"]/);
  const imported = reactImport
    ? reactImport[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    : [];
  for (const hook of HOOKS) {
    if (imported.includes(hook)) continue;
    if (new RegExp(`(?<![\\w.$])${hook}\\s*\\(`).test(src)) {
      failures.push(`${rel}: uses ${hook} without importing it from react`);
    }
  }

  if (!/const update = \(key\)/.test(src)) continue;
  const normalises = /fieldValue\(/.test(src);

  lines.forEach((line, index) => {
    const match = line.match(/onChange=\{update\((['"][^)]*)\)\}/);
    if (!match) return;
    let tag = null;
    for (let j = index; j >= 0 && j > index - 12; j--) {
      const found = lines[j].match(/<([A-Z][A-Za-z0-9]*)\b/);
      if (found) {
        tag = found[1];
        break;
      }
    }
    if (tag && VALUE_CONTROLS.includes(tag) && !normalises) {
      failures.push(`${rel}:${index + 1} <${tag}> passes a value to an event-style update() handler`);
    }
  });
}

if (failures.length) {
  // eslint-disable-next-line no-console
  console.error(`\n${failures.length} problem(s):`);
  for (const failure of failures) {
    // eslint-disable-next-line no-console
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log('\nAll form contracts hold.');
