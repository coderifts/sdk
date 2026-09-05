/**
 * LIVE vs RECORDED app-sync (1380 / 1127 / 1374 pattern).
 *
 * LIVE  — coderifts-app checkout present: compare against live generator /
 *         getCanonicalRuleText / canonical fixture, AND fail if this recording is stale.
 * RECORDED — no checkout: compare against the vendored snapshot, labeled
 *         weaker than LIVE. Missing or corrupt snapshot exits 1 — no skip.
 *
 * LIVE resolution: CODERIFTS_APP_DIR || CODERIFTS_APP_ROOT || $HOME/coderifts-app.
 * No sibling-path shortcut — that would make a local checkout look like CI.
 *
 * @module @coderifts/sdk/lib/recorded-app-sync
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = process.env.CODERIFTS_SDK_ROOT
  ? path.resolve(process.env.CODERIFTS_SDK_ROOT)
  : path.resolve(__dirname, '..');
const SNAP_DIR = path.join(ROOT, 'fixtures', 'recorded', 'app-sync');
const PIN_PATH = path.join(SNAP_DIR, 'pin.json');

function sha256hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function appRoot() {
  const fromDir = process.env.CODERIFTS_APP_DIR && String(process.env.CODERIFTS_APP_DIR).trim();
  if (fromDir) return path.resolve(fromDir);
  const fromRoot = process.env.CODERIFTS_APP_ROOT && String(process.env.CODERIFTS_APP_ROOT).trim();
  if (fromRoot) return path.resolve(fromRoot);
  return path.join(process.env.HOME || os.homedir(), 'coderifts-app');
}

function generatorsPresent() {
  const root = appRoot();
  return fs.existsSync(path.join(root, 'scripts', 'generate-grant-request-types.js'))
    && fs.existsSync(path.join(root, 'src', 'agent-host-rule.js'))
    && fs.existsSync(path.join(root, 'test', 'fixtures', 'v2-grant-canonical-request.json'));
}

function loadPin() {
  if (!fs.existsSync(PIN_PATH)) {
    const err = new Error(
      `RECORDED snapshot missing at ${PIN_PATH}. `
      + 'Reporting a comparison that did not happen is worse than failing. '
      + 'Restore fixtures/recorded/app-sync/.',
    );
    err.code = 'NO_RECORDED';
    throw err;
  }
  const pin = JSON.parse(fs.readFileSync(PIN_PATH, 'utf8'));
  if (!Array.isArray(pin.artifacts) || pin.artifacts.length === 0) {
    const err = new Error('RECORDED pin has no artifacts — refusing to skip');
    err.code = 'NO_RECORDED';
    throw err;
  }
  for (const a of pin.artifacts) {
    const p = path.join(SNAP_DIR, a.path);
    if (!fs.existsSync(p)) {
      const err = new Error(
        `RECORDED snapshot missing ${a.path} at ${p}. `
        + 'Reporting a comparison that did not happen is worse than failing.',
      );
      err.code = 'NO_RECORDED';
      throw err;
    }
    const got = sha256hex(fs.readFileSync(p));
    if (got !== a.sha256) {
      const err = new Error(
        `RECORDED snapshot corrupt ${a.path}: pin ${a.sha256} bytes ${got}`,
      );
      err.code = 'STALE_RECORDED';
      throw err;
    }
  }
  return pin;
}

function snapshotPath(rel) {
  return path.join(SNAP_DIR, rel);
}

function snapshotBytes(rel) {
  return fs.readFileSync(snapshotPath(rel));
}

function snapshotText(rel) {
  return fs.readFileSync(snapshotPath(rel), 'utf8');
}

function modeBanner(mode) {
  return mode === 'LIVE' ? '[LIVE]' : '[RECORDED — weaker than LIVE]';
}

function liveCanonicalPath() {
  return path.join(appRoot(), 'test', 'fixtures', 'v2-grant-canonical-request.json');
}

function liveGeneratorPath() {
  return path.join(appRoot(), 'scripts', 'generate-grant-request-types.js');
}

function liveRulePath() {
  return path.join(appRoot(), 'src', 'agent-host-rule.js');
}

module.exports = {
  ROOT,
  SNAP_DIR,
  PIN_PATH,
  sha256hex,
  appRoot,
  generatorsPresent,
  loadPin,
  snapshotPath,
  snapshotBytes,
  snapshotText,
  modeBanner,
  liveCanonicalPath,
  liveGeneratorPath,
  liveRulePath,
};
