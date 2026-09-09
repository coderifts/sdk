/**
 * Copy the vendored verify core into both build outputs.
 *
 * WHY A BUILD STEP AND NOT A tsc CONCERN: the vendored files are plain CommonJS JavaScript, byte
 * copies of the public receipt-verifier. tsc does not emit files it did not compile, so without
 * this `authorize()` resolves './vendor/receipt-verifier/…' inside dist/ and finds nothing —
 * which is exactly what the first build reported.
 *
 * They are COPIED rather than compiled, on purpose. Compiling them would produce files that are no
 * longer byte-identical to the pinned upstream, and the pin — and the parity test that reads it —
 * would then be checking something the build had already changed.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'vendor');
if (!existsSync(src)) {
  process.stderr.write('copy-vendor: src/vendor is missing — authorize() cannot work\n');
  process.exit(1);
}
for (const out of ['cjs', 'esm']) {
  const dest = join(root, 'dist', out, 'vendor');
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  // ── THE VENDORED BYTES ARE CommonJS, WHEREVER THEY LAND ────────────────────────────────
  //
  // MEASURED on the built package: `dist/esm/package.json` is `{"type":"module"}`, so node parsed
  // these vendored CJS files AS ESM and refused them —
  //   SyntaxError: … does not provide an export named 'default'
  // — which means the shared core has never been loadable from this package's ESM build at all.
  //
  // A one-line `package.json` beside the copies overrides the type for that subtree. It changes
  // no vendored byte: the files stay byte-identical to receipt-verifier's, and the pin and the
  // parity test that reads it keep checking the same thing.
  writeFileSync(join(dest, 'package.json'), `${JSON.stringify({ type: 'commonjs' })}\n`);
  process.stdout.write(`copy-vendor: ${dest} (marked commonjs)\n`);
}
