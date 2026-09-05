'use strict';

/**
 * Vendored-sync: CODERIFTS_POLICY must stay byte-identical to the app canonical
 * text (`getCanonicalRuleText()` in src/agent-host-rule.js).
 *
 * LIVE when the app checkout exists (byte-identical to getCanonicalRuleText;
 * fails if the recording is stale). RECORDED against fixtures/recorded/app-sync
 * when it does not (weaker, named). Missing/corrupt snapshot fails — never skip.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const rec = require('../lib/recorded-app-sync');

const { CODERIFTS_POLICY, POLICY_MARKER } = require('../dist/cjs/index.js');

const pin = rec.loadPin();
const LIVE = rec.generatorsPresent();
const MODE = LIVE ? 'LIVE' : 'RECORDED';

describe(`CODERIFTS_POLICY vendored-sync (sdk ↔ app) ${rec.modeBanner(MODE)}`, () => {
  it('constant matches LIVE app text or the RECORDED snapshot', () => {
    const snap = rec.snapshotText('policy.txt');
    assert.ok(pin);
    assert.ok(CODERIFTS_POLICY.includes(POLICY_MARKER));
    if (LIVE) {
      const rulePath = rec.liveRulePath();
      assert.ok(fs.existsSync(rulePath), `app canonical missing at ${rulePath}`);
      const { getCanonicalRuleText } = require(rulePath);
      const appText = getCanonicalRuleText();
      assert.equal(
        CODERIFTS_POLICY,
        appText,
        'CODERIFTS_POLICY drifted from app getCanonicalRuleText(). '
        + 'Re-vendor from coderifts-app/src/agent-host-rule.js. Do not hand-edit only one side. '
        + rec.modeBanner('LIVE'),
      );
      assert.equal(
        snap,
        appText,
        'RECORDED snapshot STALE vs live getCanonicalRuleText() — regenerate fixtures/recorded/app-sync',
      );
      assert.ok(appText.includes(POLICY_MARKER));
    } else {
      assert.equal(
        CODERIFTS_POLICY,
        snap,
        'CODERIFTS_POLICY drifted from the RECORDED snapshot. ' + rec.modeBanner('RECORDED'),
      );
    }
  });

});
