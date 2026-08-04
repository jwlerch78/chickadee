// mirror-dev-channel.mjs — produce `chickadee_dev/` from `chickadee/`.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// The generator writes ONE add-on channel (`chickadee/`). The dev channel has
// always been a hand-run rsync of it — which means the repo's second shipping
// artifact was produced by a command nobody could read afterwards, and no gate
// covered it. The honest report each time it came up was: nothing checks this,
// it was verified by hand.
//
// A hand-run copy of a generated tree is a hand-mirror in the most literal
// sense. The standing rule says eliminate the seam before linting it, so the
// copy is a script now, and `verify-channels.mjs` imports the SAME exemption
// list this file mirrors with. One definition, used to write and to check —
// a mirror that drifts from its checker is the failure being prevented.
//
// Usage:  node scripts/mirror-dev-channel.mjs                 (mirror prod → dev)
//         node scripts/mirror-dev-channel.mjs --check         (wires + content)
//         node scripts/mirror-dev-channel.mjs --check-wires   (the continuous set)
//         node scripts/mirror-dev-channel.mjs --check-content (the promotion set)
//
// The check modes write NOTHING — a check that repairs the thing it is checking
// always passes, and leaves a dirty tree for someone else to commit or
// `checkout` away.
//
// ── 🔴 THE SPLIT (2026-08-04, Thread S under John's promotion-split order) ────
//
// This file used to answer ONE question — *are the two channels the same?* —
// and `verify-channels.mjs` asserted it continuously. That was correct while
// chickadee had no dev→prod promotion split. It is wrong now, and wrong in the
// worst direction: **it forbids the state the system is designed to be in.**
//
// Under the split, `chickadee/` is the generated tree AND the prod channel;
// `chickadee_dev/` is the frozen record of the last dev release. Between
// promotions the prod DIRECTORY legitimately leads the dev directory in
// CONTENT (authoring continues), while the dev VERSION leads the prod VERSION
// (dev cuts, prod promotes). A byte-sweep asserted continuously goes red on a
// perfectly correct tree — observed live on the pushed repo at `35ed5da`.
//
// So the comparison splits BY QUESTION, not by caller:
//
//   compareChannelWires()    slugs · discovery · dev ≥ prod version
//                            → CONTINUOUS (verify-channels leg 7). These are
//                              the values two files must agree on at all times;
//                              each one has broken a real box, and checking
//                              them only at a promotion is far too late.
//
//   compareChannelContent()  the file-set + byte sweep
//                            → AT PROMOTIONS ONLY (promote-prod.sh). Equality
//                              of content is true at exactly one instant — the
//                              moment prod is rebuilt from the dev release it
//                              claims to promote — which is precisely where
//                              `dashie-ha-console`'s promotion verify asserts
//                              it, and the model John said to match.
//
// `compareChannels()` remains as the union, because "is the mirror whole right
// now" is still the right question immediately after `mirror()` runs, where
// both halves genuinely do hold.

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROD_CHANNEL = 'chickadee';
export const DEV_CHANNEL = 'chickadee_dev';

/**
 * 🔴 THE ONLY FILES ALLOWED TO DIFFER BETWEEN THE TWO CHANNELS.
 *
 *   config.yaml    the channel's IDENTITY. `slug` must differ (both channels
 *                  install side by side, each with its own /data), the name and
 *                  panel title say which one you are looking at, and the dev
 *                  channel declares `lease_ttl_seconds` — a debug override that
 *                  is kept OUT of the prod schema so Home Assistant rejects it
 *                  there. That absence is the entire enforcement; no code
 *                  branch implements it.
 *   CHANGELOG.md   the dev channel's history is a list of pre-release builds,
 *                  and the prod channel's is a list of promotions. Different
 *                  documents about different events.
 *
 * ⚠️ NOT the same list as the pre-commit hook's hand-authored set, and the
 * difference is deliberate rather than an oversight. That hook answers *may I
 * EDIT this here* (config.yaml · DOCS.md · CHANGELOG.md, because a generator
 * cannot write them). This answers *may the two CHANNELS disagree about it*.
 * DOCS.md is hand-authored and must still be IDENTICAL in both channels —
 * it is what Home Assistant shows on the add-on page, and there is nothing
 * about the dev channel that belongs there which config.yaml's own description
 * does not already say. If that ever changes, add it here on purpose; the gate
 * failing is how the decision gets made rather than drifted into.
 */
export const PER_CHANNEL_FILES = ['config.yaml', 'CHANGELOG.md'];

/**
 * 🔴 INVARIANT — `config.yaml` MUST be in PER_CHANNEL_FILES, and this is the
 * property that makes `mirror()` safe rather than catastrophic.
 *
 * Stated because until now it was a **happy accident** (B's finding 3,
 * 2026-08-04). `mirror()` is a wholesale `rm -rf` + `cpSync` of prod over dev.
 * The ONLY thing standing between that and the dev channel inheriting prod's
 * `slug` is this list: the preserve-before-replace loop reads dev's own
 * config.yaml first and writes it back after. Drop `config.yaml` from the list
 * — a one-token edit that reads like a simplification — and the very next
 * mirror gives `chickadee_dev/` the slug `chickadee`. The two channels become
 * the SAME add-on, installing one replaces the other and inherits its /data,
 * and slug is immutable once shipped, so it is the one mistake here that cannot
 * be corrected afterwards.
 *
 * A comment saying so would be a wish. This throws.
 */
const MUST_BE_PER_CHANNEL = ['config.yaml'];
for (const f of MUST_BE_PER_CHANNEL) {
  if (!PER_CHANNEL_FILES.includes(f)) {
    throw new Error(
      `mirror-dev-channel: PER_CHANNEL_FILES must contain "${f}" — mirror() is an rm+copy, ` +
      `and preserving it is the only thing that keeps the dev channel's own slug. See the ` +
      `invariant note above this check before changing the list.`,
    );
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every file under `dir`, as paths relative to it. */
export function listFiles(dir, base = dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__pycache__') continue;
      listFiles(p, base, out);
    } else {
      out.push(path.relative(base, p));
    }
  }
  return out;
}

const bothPresent = (root) => {
  const prod = path.join(root, PROD_CHANNEL);
  const dev = path.join(root, DEV_CHANNEL);
  if (existsSync(prod) && existsSync(dev)) return null;
  return `${!existsSync(prod) ? PROD_CHANNEL : DEV_CHANNEL}/ is missing — cannot compare`;
};

const readCfg = (dir) =>
  existsSync(path.join(dir, 'config.yaml')) ? readFileSync(path.join(dir, 'config.yaml'), 'utf8') : '';
const cfgSlug = (t) => (t.match(/^slug:\s*(\S+)/m) || [])[1] ?? null;
const cfgVersion = (t) => (t.match(/^version:\s*"?([^"\s]+)"?/m) || [])[1] ?? null;
const cfgDiscovery = (t) => {
  const m = t.match(/^discovery:\s*\n((?:\s*-\s*\S+\n)+)/m);
  return m ? m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean).sort() : [];
};
const cmpVersion = (a, b) => {
  const [x, y] = [a, b].map((v) => (v ?? '0').split('.').map((n) => parseInt(n, 10) || 0));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
};

/**
 * THE CONTINUOUS SET — the values the two channels must agree on at ALL times,
 * promotion or not. `verify-channels.mjs` leg 7 asserts exactly this and
 * nothing more.
 *
 * Every check here is a WIRE: a value that lives in two files and breaks a real
 * box when they disagree. None of them is a statement about how far apart the
 * two trees' contents have drifted, which is why none of them goes red when the
 * split is working as designed.
 */
export function compareChannelWires(root = repoRoot) {
  const missing = bothPresent(root);
  if (missing) return [missing];

  const prod = path.join(root, PROD_CHANNEL);
  const dev = path.join(root, DEV_CHANNEL);
  const problems = [];
  const [pt, dt] = [readCfg(prod), readCfg(dev)];

  // 🔴 SLUGS MUST DIFFER, and each must equal its own directory name. Equal
  // slugs would make the two channels the same add-on — installing one would
  // replace the other and inherit its /data. Slug is immutable once shipped, so
  // this is the one field where a mistake cannot be corrected later.
  if (cfgSlug(pt) === cfgSlug(dt)) {
    problems.push(`both channels declare slug "${cfgSlug(pt)}" — they would be the same add-on`);
  }
  if (cfgSlug(pt) !== PROD_CHANNEL) problems.push(`${PROD_CHANNEL}/config.yaml declares slug "${cfgSlug(pt)}", not "${PROD_CHANNEL}"`);
  if (cfgSlug(dt) !== DEV_CHANNEL) problems.push(`${DEV_CHANNEL}/config.yaml declares slug "${cfgSlug(dt)}", not "${DEV_CHANNEL}"`);

  // The discovery service is a WIRE value shared with the vendored integration,
  // which is byte-identical in both channels — so a channel declaring a
  // different one is declaring a service its own integration does not provide.
  // Supervisor 403s that, repeating every worker cycle (observed on a fresh box).
  const [pd, dd] = [cfgDiscovery(pt), cfgDiscovery(dt)];
  if (pd.join(',') !== dd.join(',')) {
    problems.push(`discovery services disagree: ${PROD_CHANNEL}=[${pd}] ${DEV_CHANNEL}=[${dd}] — both vendor the SAME integration`);
  }

  // Versions may differ — that is the model, not a defect: dev cuts a build and
  // a prod release is a PROMOTION of one. What must never happen is dev falling
  // BEHIND prod, which would mean shipping to users something the dev channel
  // never ran. This is the one direction that stays a hard failure, and it is
  // the reason the version check belongs in the continuous set rather than in
  // the promotion set with the rest of the comparison.
  if (cmpVersion(cfgVersion(dt), cfgVersion(pt)) < 0) {
    problems.push(`${DEV_CHANNEL} is v${cfgVersion(dt)} but ${PROD_CHANNEL} is v${cfgVersion(pt)} — prod would ship a build dev never ran`);
  }

  return problems;
}

/**
 * THE PROMOTION SET — the byte sweep. TRUE AT EXACTLY ONE INSTANT: when prod
 * has just been rebuilt from the dev release it claims to promote.
 *
 * ⚠️ Do NOT wire this into a continuous gate. Between promotions the prod
 * directory legitimately leads the dev directory in content, and asserting this
 * continuously means a gate that fails on a correct tree — which is how it was
 * wired before 2026-08-04 and what made leg 7 red on the pushed repo at
 * `35ed5da` while nothing whatsoever was wrong.
 *
 * Its caller is `promote-prod.sh`'s promotion proof, which is the same place
 * `dashie-ha-console/scripts/release.sh` asserts the identical property.
 */
export function compareChannelContent(root = repoRoot) {
  const missing = bothPresent(root);
  if (missing) return [missing];

  const prod = path.join(root, PROD_CHANNEL);
  const dev = path.join(root, DEV_CHANNEL);
  const problems = [];

  const inProd = new Set(listFiles(prod));
  const inDev = new Set(listFiles(dev));

  for (const f of inProd) if (!inDev.has(f)) problems.push(`only in ${PROD_CHANNEL}/: ${f}`);
  for (const f of inDev) if (!inProd.has(f)) problems.push(`only in ${DEV_CHANNEL}/: ${f}`);

  for (const f of inProd) {
    if (!inDev.has(f) || PER_CHANNEL_FILES.includes(f)) continue;
    const a = readFileSync(path.join(prod, f));
    const b = readFileSync(path.join(dev, f));
    if (!a.equals(b)) problems.push(`differs: ${f}`);
  }

  return problems;
}

/**
 * Report-only: how far the dev channel leads prod, **measured in VERSION** and
 * never in files (B's finding 4). A file count would answer a different
 * question than the one the phrase asks, and would go up merely because
 * authoring continued.
 *
 * Returns `null` when the versions are equal or unreadable — i.e. when there is
 * nothing to report — so the caller does not have to decide what "leading by
 * zero" should print.
 */
export function channelVersionDelta(root = repoRoot) {
  const prod = cfgVersion(readCfg(path.join(root, PROD_CHANNEL)));
  const dev = cfgVersion(readCfg(path.join(root, DEV_CHANNEL)));
  if (!prod || !dev) return null;
  const c = cmpVersion(dev, prod);
  if (c === 0) return null;
  const [dp, pp] = [dev, prod].map((v) => v.split('.').map((n) => parseInt(n, 10) || 0));
  const samePrefix = dp[0] === pp[0] && dp[1] === pp[1];
  return {
    prod,
    dev,
    devLeads: c > 0,
    // Only claim a patch count when the majors and minors match; across a minor
    // bump "by N patches" would be arithmetic on incomparable things.
    patches: samePrefix ? Math.abs((dp[2] ?? 0) - (pp[2] ?? 0)) : null,
    text: c > 0
      ? `dev v${dev} leads prod v${prod}${samePrefix ? ` by ${Math.abs((dp[2] ?? 0) - (pp[2] ?? 0))} patch(es)` : ''} — unpromoted, which is the model`
      : `dev v${dev} is BEHIND prod v${prod}`,
  };
}

/**
 * The union — wires AND content. This is the right question in exactly one
 * place: immediately after `mirror()` writes, where both halves genuinely hold.
 * A continuous gate wants `compareChannelWires` and a promotion wants
 * `compareChannelContent`; reach for this only when you mean both.
 */
export function compareChannels(root = repoRoot) {
  const missing = bothPresent(root);
  if (missing) return [missing];
  return [...compareChannelContent(root), ...compareChannelWires(root)];
}

/** Mirror prod → dev, preserving the per-channel files. */
function mirror() {
  const prod = path.join(repoRoot, PROD_CHANNEL);
  const dev = path.join(repoRoot, DEV_CHANNEL);
  if (!existsSync(prod)) {
    console.error(`mirror-dev-channel: ${PROD_CHANNEL}/ not found`);
    process.exit(2);
  }

  // Preserve before replace, for the reason brand-gen learned the hard way: the
  // write is a wholesale rm + copy, and "this file is not mine to write" has to
  // include "not mine to delete" or the exemption means nothing. The generator
  // deleted three hand-authored files this way once, silently, with a ✅ on its
  // last line.
  const kept = new Map();
  for (const f of PER_CHANNEL_FILES) {
    const p = path.join(dev, f);
    if (existsSync(p)) kept.set(f, readFileSync(p));
  }
  const missing = PER_CHANNEL_FILES.filter((f) => !kept.has(f));
  if (missing.length && existsSync(dev)) {
    console.error(`mirror-dev-channel: ❌ refusing — ${DEV_CHANNEL}/ is missing its own ${missing.join(', ')}.`);
    console.error(`               Mirroring now would copy ${PROD_CHANNEL}'s in and give the dev`);
    console.error(`               channel prod's slug. Restore them first (git checkout).`);
    process.exit(1);
  }

  rmSync(dev, { recursive: true, force: true });
  mkdirSync(path.dirname(dev), { recursive: true });
  cpSync(prod, dev, { recursive: true });
  for (const [f, buf] of kept) writeFileSync(path.join(dev, f), buf);

  const problems = compareChannels();
  console.log(`✅ mirrored ${PROD_CHANNEL}/ → ${DEV_CHANNEL}/ (kept ${[...kept.keys()].join(', ')})`);
  if (problems.length) {
    console.log('\n⚠️  and the mirror still does not hold — the per-channel files disagree:');
    for (const p of problems) console.log(`   • ${p}`);
    process.exit(1);
  }
}

// Only act when run directly; verify-channels.mjs imports the comparison.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Each mode names WHICH question it answered in its own output. A check that
  // prints "✅" without saying what it looked at is how "residue 0" came to mean
  // "zero the pattern could see" three times in this repo's history.
  const mode =
    process.argv.includes('--check-wires') ? 'wires'
    : process.argv.includes('--check-content') ? 'content'
    : process.argv.includes('--check') ? 'both'
    : 'mirror';

  if (mode === 'mirror') {
    mirror();
  } else {
    const run = { wires: compareChannelWires, content: compareChannelContent, both: compareChannels }[mode];
    const label = {
      wires: 'the channel WIRES agree (slugs distinct, discovery equal, dev ≥ prod version)',
      content: 'the two channel trees are byte-identical except ' + PER_CHANNEL_FILES.join(', '),
      both: 'the dev channel mirrors the prod channel (wires AND content)',
    }[mode];
    const problems = run();
    for (const p of problems) console.log(`❌ ${p}`);
    if (problems.length) {
      console.log(`\n${problems.length} problem(s) — checked: ${label}`);
    } else {
      console.log(`✅ ${label}`);
      // Content equality is a promotion-instant property, so a bare green from
      // --check-content invites the reading "and therefore the channels are in
      // step". Say what it does not mean, at the one moment someone is reading.
      if (mode === 'content') {
        const d = channelVersionDelta();
        if (d) console.log(`   (${d.text} — content equality says nothing about versions)`);
      }
    }
    process.exit(problems.length ? 1 : 0);
  }
}
