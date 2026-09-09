#!/usr/bin/env node
'use strict';

/**
 * Pack → install the tarball into a temp dir → require the documented entry.
 *
 * Pattern (1413 / prove check-packed-sample.js): the working tree is not the
 * artifact. So: `npm pack`, install THAT tarball, then run the documented
 * smoke (README: `import { CodeRifts } from '@coderifts/sdk'`).
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.error) throw r.error;
  return r;
}

function fail(msg) {
  process.stderr.write(`FAIL: ${msg}\n`);
  process.exit(1);
}

const distMain = path.join(REPO, 'dist', 'cjs', 'index.js');
if (!fs.existsSync(distMain)) {
  fail(`dist/cjs/index.js is missing — run npm run build before packing. `
    + 'A tarball without dist cannot load.');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-pack-'));
try {
  const packed = run('npm', ['pack', '--silent', '--pack-destination', tmp], { cwd: REPO });
  if (packed.status !== 0) fail(`npm pack failed:\n${packed.stderr}`);
  const tgz = packed.stdout.trim().split('\n').pop().trim();
  const tarball = path.join(tmp, path.basename(tgz));
  if (!fs.existsSync(tarball)) fail(`npm pack reported ${tgz} but no tarball is there`);
  process.stdout.write(`tarball              : ${path.basename(tarball)} `
    + `(${fs.statSync(tarball).size} bytes)\n`);

  const installDir = path.join(tmp, 'install');
  fs.mkdirSync(installDir);
  const init = run('npm', ['init', '-y'], { cwd: installDir });
  if (init.status !== 0) fail(`npm init failed:\n${init.stderr}`);
  const inst = run('npm', ['install', tarball], { cwd: installDir });
  if (inst.status !== 0) fail(`npm install tarball failed:\n${inst.stderr}`);

  const smoke = run(process.execPath, ['-e',
    "const s = require('@coderifts/sdk');\n"
    + "if (typeof s.CodeRifts !== 'function') throw new Error('CodeRifts missing');\n"
    + "process.stdout.write('ok require @coderifts/sdk CodeRifts\\n');\n",
  ], { cwd: installDir });
  process.stdout.write(smoke.stdout);
  if (smoke.status !== 0) fail(`documented require failed:\n${smoke.stderr}`);
  process.stdout.write('packed install smoke: OK\n');

  // ── THE DOC INSIDE THE TARBALL, NOT THE DOC IN THE TREE ────────────────────────────────
  //
  // MEASURED at 3.14.0: README.md said 3.10.0. `prepack` now stamps it from package.json, but a
  // stamper is a build step, and a build step that silently no-ops is indistinguishable from one
  // that ran — unless something reads the RESULT back out of the shipped bytes. That is this.
  //
  // It reads the installed copy: past `files`, past `.npmignore`, past a prepack that did not fire
  // because the publish path skipped it. An adopter's first act is `npm install`, and this is the
  // README they get.
  const installedReadme = path.join(installDir, 'node_modules', '@coderifts', 'sdk', 'README.md');
  if (!fs.existsSync(installedReadme)) fail('the tarball ships no README.md — the doc an adopter '
    + 'reads on npm is absent from the package');
  const declared = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
  const stamped = /^Current package: \*\*([^*]+)\*\*\.$/m.exec(fs.readFileSync(installedReadme, 'utf8'));
  if (!stamped) fail('the shipped README carries no "Current package" line — either the doc lost '
    + 'it or prepack failed to stamp it; a version an adopter cannot read is not published');
  if (stamped[1] !== declared) {
    fail(`the shipped README says ${stamped[1]} and the package is ${declared} — this is the `
      + '3.10.0-vs-3.14.0 defect, shipped');
  }
  process.stdout.write(`shipped README version: ${stamped[1]} == package ${declared}\n`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
