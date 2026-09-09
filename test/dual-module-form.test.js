'use strict';

/**
 * `authorize()` must be callable from BOTH consumers of the published package.
 *
 * ── THE DEFECT THIS EXISTS FOR ──────────────────────────────────────────────────────────────
 *
 * MEASURED against the published 3.14.0 tarball, packed, installed into a fresh project, and
 * imported from a real `.mjs`:
 *
 *   import { authorize } from '@coderifts/sdk';   ->  authorize typeof: function
 *   authorize({ ... })                            ->  ReferenceError: require is not defined
 *                                                     in ES module scope
 *                                                     at dist/esm/authorize.js:64
 *
 * The export existed, the types were right, the import succeeded, and the call threw. That gap
 * between "imports" and "runs" is why it lasted several releases.
 *
 * ── WHY THE SUITE NEVER SAW IT ──────────────────────────────────────────────────────────────
 *
 * Every test in this directory loads `dist/cjs` (or `src`). A call-time `require(...)` compiles
 * cleanly, runs correctly in CJS, and is invisible to `tsc` — it is not a module reference the
 * compiler tracks, so no build error and no type error appears in the ONE build where it cannot
 * work. Nothing here had ever loaded `dist/esm` at all.
 *
 * So the class matters more than the instance: this file loads the ESM output, and scans ALL of
 * it, rather than asserting that one known line is gone.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const CJS = path.join(ROOT, 'dist', 'cjs');
const ESM = path.join(ROOT, 'dist', 'esm');

/** The input both forms are given. Deliberately minimal: this is a module-form test, not a policy test. */
const INPUT = Object.freeze({ receipt: { verified: true }, grant: {}, committed: true });

/** What a real result must look like, whichever module system produced it. */
function assertAuthorizeResult(r, form) {
    assert.equal(typeof r, 'object', `${form}: authorize returned no object`);
    assert.equal(typeof r.state, 'string', `${form}: no state`);
    assert.equal(typeof r.authorized_and_committed, 'boolean', `${form}: no verdict boolean`);
    assert.ok(Array.isArray(r.shortfalls), `${form}: no shortfalls array`);
    // A caller-asserted receipt with no grant cannot be authorized. Asserted so the call is proven
    // to have reached the core rather than returning some empty shape that satisfies the shape
    // checks above.
    assert.equal(r.authorized_and_committed, false, `${form}: an empty grant was authorized`);
    assert.ok(r.shortfalls.length > 0, `${form}: refused with no reason — the core was not reached`);
}

/**
 * Strip comments before scanning for `require(`.
 *
 * MEASURED while writing this: the fix's own explanation, which quotes the broken line, sits in a
 * comment in `dist/esm/authorize.js` — so a naive grep for `require(` matched the FIX and would
 * have failed this test on a correct build. A scanner that cannot tell code from prose does not
 * get to police prose.
 *
 * This is a lexical strip, not a parser: it removes block comments, line comments, and the string
 * and template literals that could otherwise hide a `//` or a quote. Good enough for the question
 * asked — is there a `require(` in EXECUTABLE position — and it is checked against a fixture below
 * rather than trusted.
 */
function stripCommentsAndStrings(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i];
        const d = src[i + 1];
        if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? n : e + 2; continue; }
        if (c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e === -1 ? n : e; continue; }
        if (c === '"' || c === "'" || c === '`') {
            i += 1;
            while (i < n && src[i] !== c) i += (src[i] === '\\' ? 2 : 1);
            i += 1;
            out += '""';
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

describe('the ESM build has no bare require — the exact failure mode, scanned for as a class', () => {
    it('the stripper tells code from prose, or this whole check is decorative', () => {
        // The fixture is the shape that actually occurred: the real line, and a comment quoting it.
        const withProse = '// a bare `require(...)` used to be here\nconst x = 1;\n';
        const withCode = 'const { a } = require("./b.js");\n';
        assert.doesNotMatch(stripCommentsAndStrings(withProse), /require\s*\(/,
            'the stripper flags a comment as code — every ESM file that explains this bug would fail');
        assert.match(stripCommentsAndStrings(withCode), /require\s*\(/,
            'the stripper eats real code — the check would pass on a broken build');
    });

    it('no .js in dist/esm calls require in executable position', () => {
        assert.ok(fs.existsSync(ESM), 'dist/esm is missing — run npm run build');
        const files = fs.readdirSync(ESM).filter((f) => f.endsWith('.js'));
        assert.ok(files.length > 0, 'dist/esm has no .js files at all');
        const offenders = files.filter((f) =>
            /(^|[^.\w])require\s*\(/.test(stripCommentsAndStrings(fs.readFileSync(path.join(ESM, f), 'utf8'))));
        assert.deepEqual(offenders, [],
            `these ESM modules call require and will throw "require is not defined" for every ESM `
            + `consumer: ${offenders.join(', ')}`);
    });

    it('the vendored core is loadable FROM the ESM build, not merely present in it', async () => {
        // Being copied in is not the same as loading. `dist/esm/package.json` is {"type":"module"},
        // so the vendored CommonJS would be read as ESM without the {"type":"commonjs"} marker
        // copy-vendor writes beside it — and the failure is at load, phrased as "does not provide
        // an export named default". Measured on this build: the marker is present and it loads.
        const marker = path.join(ESM, 'vendor', 'package.json');
        assert.ok(fs.existsSync(marker), 'dist/esm/vendor has no package.json type marker');
        assert.equal(JSON.parse(fs.readFileSync(marker, 'utf8')).type, 'commonjs');
        const core = await import(pathToFileURL(
            path.join(ESM, 'vendor', 'receipt-verifier', 'verified-execution-binding.js')).href);
        assert.equal(typeof (core.default || {}).verifiedExecutionBinding, 'function',
            'the vendored core did not expose verifiedExecutionBinding through the ESM build');
    });
});

describe('authorize() is importable AND callable in both module forms', () => {
    it('CJS: require(dist/cjs) gives a function that runs', () => {
        const { authorize } = require(path.join(CJS, 'index.js'));
        assert.equal(typeof authorize, 'function');
        assertAuthorizeResult(authorize(INPUT), 'CJS');
    });

    it('ESM: import(dist/esm) gives a function that runs', async () => {
        const mod = await import(pathToFileURL(path.join(ESM, 'index.js')).href);
        assert.equal(typeof mod.authorize, 'function',
            'authorize is not exported from the ESM build');
        assertAuthorizeResult(mod.authorize(INPUT), 'ESM');
    });

    it('and both forms agree, field for field — the fix changed the module form, not the answer', async () => {
        const cjs = require(path.join(CJS, 'index.js')).authorize(INPUT);
        const esm = (await import(pathToFileURL(path.join(ESM, 'index.js')).href)).authorize(INPUT);
        // Serialised rather than deepEqual'd so a Map or a key-order difference between the two
        // builds shows up as a diff instead of being smoothed over.
        assert.equal(JSON.stringify(esm), JSON.stringify(cjs),
            'the two builds of the same function returned different results');
    });
});
