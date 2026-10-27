import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Architecture guard: opening the native handle is allowed only in
 * src/storage/connection.ts, which keeps one never-closed connection. Every
 * screen, dock and Focus consumer reads it through the serial gate. Direct
 * hooks, providers or openDatabase calls elsewhere can bypass the gate or
 * reintroduce the issue #2 lifecycle race.
 */
const allowed = new Set(['src/storage/connection.ts']);
const violations = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { walk(full); continue; }
    if (!/\.(ts|tsx)$/.test(name)) continue;
    const file = relative('.', full).replaceAll('\\', '/');
    const source = readFileSync(full, 'utf8');
    if (!allowed.has(file) && /\b(?:useSQLiteContext|SQLiteProvider|openDatabase(?:Async|Sync)?)\b/.test(source)) violations.push(file);
  }
}
walk('src');
walk('app');
if (violations.length) {
  console.error('SQLite handle opened or provided outside the single guarded connection:\n' + violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('SQLite access boundary: all feature consumers use the guarded connection.');
}
