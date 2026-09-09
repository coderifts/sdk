/**
 * Stamp the published version into the shipped docs, from package.json.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────
 *
 * MEASURED at 3.14.0: README.md said "Current package: **3.10.0**" — four minor versions stale,
 * on the line an adopter reads before installing anything. Nothing was wrong with the release; the
 * literal was hand-maintained, and hand-maintained literals go stale in the direction of the last
 * person who remembered. The python SDK's `__version__` had the same defect in the same release
 * and was fixed the same way: derive it, do not restate it.
 *
 * This runs in `prepack`, so the bytes that ship are stamped whether or not anybody remembered.
 * `check:packed` then reads the stamped line back OUT OF THE TARBALL — because a build step that
 * silently no-ops looks exactly like a build step that ran.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** The one line that carries the version, matched by its LABEL rather than by its value. */
export const VERSION_LINE = (v) => `Current package: **${v}**.`;
export const VERSION_LINE_RE = /^Current package: \*\*([^*]+)\*\*\.$/m;

const README = path.join(ROOT, 'README.md');
const before = fs.readFileSync(README, 'utf8');
if (!VERSION_LINE_RE.test(before)) {
  // Fail rather than append. A stamper that invents the line it cannot find would put a version
  // marker somewhere nobody chose, in a doc that ships.
  console.error(`stamp-doc-version: README.md carries no "${VERSION_LINE('X')}" line to stamp`);
  process.exit(1);
}
const after = before.replace(VERSION_LINE_RE, VERSION_LINE(version));
if (after !== before) fs.writeFileSync(README, after);
console.log(`stamp-doc-version: README.md → ${version}${after === before ? ' (already current)' : ''}`);
