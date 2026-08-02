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
// Usage:  node scripts/mirror-dev-channel.mjs          (mirror prod → dev)
//         node scripts/mirror-dev-channel.mjs --check  (report, write nothing)
//
// The check mode is what CI runs, via verify-channels.mjs. It writes NOTHING —
// a check that repairs the thing it is checking always passes, and leaves a
// dirty tree for someone else to commit or `checkout` away.

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

/**
 * Compare the two channels. Returns a list of problems, empty when the mirror
 * holds. Exported because `verify-channels.mjs` is the one place all the static
 * checks are reported from, and a second reporter is a second thing to keep in
 * step.
 */
export function compareChannels(root = repoRoot) {
  const prod = path.join(root, PROD_CHANNEL);
  const dev = path.join(root, DEV_CHANNEL);
  const problems = [];

  if (!existsSync(prod) || !existsSync(dev)) {
    return [`${!existsSync(prod) ? PROD_CHANNEL : DEV_CHANNEL}/ is missing — cannot compare`];
  }

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

  // The exempted file still has properties that must hold. Exempt from
  // byte-identity is not exempt from every check — the four wires that once
  // broke a box were all values two files had to agree on.
  const cfg = (dir) => (existsSync(path.join(dir, 'config.yaml')) ? readFileSync(path.join(dir, 'config.yaml'), 'utf8') : '');
  const slug = (t) => (t.match(/^slug:\s*(\S+)/m) || [])[1] ?? null;
  const version = (t) => (t.match(/^version:\s*"?([^"\s]+)"?/m) || [])[1] ?? null;
  const discovery = (t) => {
    const m = t.match(/^discovery:\s*\n((?:\s*-\s*\S+\n)+)/m);
    return m ? m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean).sort() : [];
  };
  const [pt, dt] = [cfg(prod), cfg(dev)];

  // 🔴 SLUGS MUST DIFFER, and each must equal its own directory name. Equal
  // slugs would make the two channels the same add-on — installing one would
  // replace the other and inherit its /data. Slug is immutable once shipped, so
  // this is the one field where a mistake cannot be corrected later.
  if (slug(pt) === slug(dt)) {
    problems.push(`both channels declare slug "${slug(pt)}" — they would be the same add-on`);
  }
  if (slug(pt) !== PROD_CHANNEL) problems.push(`${PROD_CHANNEL}/config.yaml declares slug "${slug(pt)}", not "${PROD_CHANNEL}"`);
  if (slug(dt) !== DEV_CHANNEL) problems.push(`${DEV_CHANNEL}/config.yaml declares slug "${slug(dt)}", not "${DEV_CHANNEL}"`);

  // The discovery service is a WIRE value shared with the vendored integration,
  // which is byte-identical in both channels — so a channel declaring a
  // different one is declaring a service its own integration does not provide.
  // Supervisor 403s that, repeating every worker cycle (observed on a fresh box).
  const [pd, dd] = [discovery(pt), discovery(dt)];
  if (pd.join(',') !== dd.join(',')) {
    problems.push(`discovery services disagree: ${PROD_CHANNEL}=[${pd}] ${DEV_CHANNEL}=[${dd}] — both vendor the SAME integration`);
  }

  // Versions may differ — that is the model, not a defect: dev runs a build
  // first and a prod release is a promotion of it. What must never happen is
  // dev falling BEHIND prod, which would mean shipping to users something the
  // dev channel never ran.
  const cmp = (a, b) => {
    const [x, y] = [a, b].map((v) => (v ?? '0').split('.').map((n) => parseInt(n, 10) || 0));
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    }
    return 0;
  };
  if (cmp(version(dt), version(pt)) < 0) {
    problems.push(`${DEV_CHANNEL} is v${version(dt)} but ${PROD_CHANNEL} is v${version(pt)} — prod would ship a build dev never ran`);
  }

  return problems;
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
  if (process.argv.includes('--check')) {
    const problems = compareChannels();
    for (const p of problems) console.log(`❌ ${p}`);
    console.log(problems.length ? `\n${problems.length} mirror problem(s)` : '✅ the dev channel mirrors the prod channel');
    process.exit(problems.length ? 1 : 0);
  } else {
    mirror();
  }
}
