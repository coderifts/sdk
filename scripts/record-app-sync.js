#!/usr/bin/env node
'use strict';

/**
 * Re-record fixtures/recorded/app-sync from the coderifts-app checkout (2026-09-27).
 *
 * The three sync gates (canonical-v2-request, generated-grant-request-sync, policy-vendored-sync)
 * compare against the LIVE app when it is present and against this RECORDED snapshot when it is not
 * (CI, where the app repository is private). Measured today: policy.txt was the rule text of
 * @coderifts/sdk 3.14.2 while the app and src/policy.ts had moved on, so policy-vendored-sync and
 * the clean-room gate failed with "RECORDED snapshot STALE". There was no script for this; the
 * snapshot was re-made by hand. Same shape as api-governance scripts/record-app-generator.mjs.
 *
 * Each artifact is produced from the SAME live source the gates read (lib/recorded-app-sync.js):
 *   canonical-request-fixture     → copy of the app's test/fixtures/v2-grant-canonical-request.json
 *   generated-grant-request-type  → the app's generator, --out straight into the snapshot
 *   canonical-policy-text         → getCanonicalRuleText() from the app's src/agent-host-rule.js
 * then sha256 / bytes are rewritten and producer.commit is the app's HEAD. Nothing is written into
 * the app tree.
 *
 *   node scripts/record-app-sync.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const rec = require('../lib/recorded-app-sync');

function fail(msg) {
  process.stderr.write(`record-app-sync: ${msg}\n`);
  process.exit(1);
}

const APP = rec.appRoot();
if (!fs.existsSync(rec.liveRulePath())) fail(`no coderifts-app checkout at ${APP} (set CODERIFTS_APP_DIR)`);

const PRODUCE = {
  'canonical-request-fixture': (dest) => fs.copyFileSync(rec.liveCanonicalPath(), dest),
  'generated-grant-request-type': (dest) => {
    const r = spawnSync(process.execPath, [rec.liveGeneratorPath(), '--out', dest], {
      cwd: APP, encoding: 'utf8', env: { ...process.env, LOG_LEVEL: 'silent' },
    });
    if (r.status !== 0) fail(`generate-grant-request-types.js exited ${r.status}\n${r.stderr}`);
  },
  'canonical-policy-text': (dest) => {
    process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
    const { getCanonicalRuleText } = require(rec.liveRulePath());
    fs.writeFileSync(dest, getCanonicalRuleText());
  },
};

const pin = rec.loadPin();
for (const a of pin.artifacts) {
  const produce = PRODUCE[a.role];
  if (!produce) fail(`no producer for role ${a.role} (${a.path}) — add one rather than skipping it`);
  const dest = rec.snapshotPath(a.path);
  produce(dest);
  const buf = fs.readFileSync(dest);
  a.sha256 = rec.sha256hex(buf);
  a.bytes = buf.length;
}
const head = spawnSync('git', ['-C', APP, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
if (head.status !== 0) fail(`git rev-parse HEAD failed in ${APP}`);
pin.producer.commit = head.stdout.trim();
fs.writeFileSync(rec.PIN_PATH, `${JSON.stringify(pin, null, 2)}\n`);
process.stdout.write(`recorded ${pin.artifacts.length} artifacts at ${pin.producer.commit} (${path.relative(rec.ROOT, rec.SNAP_DIR)})\n`);
