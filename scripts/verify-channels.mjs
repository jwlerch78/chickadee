// verify-channels.mjs — everything about a channel that can be checked WITHOUT
// building an image. One command, so T and S have a single cheap gate to call
// before paying for a real build.
//
// ── WHERE THIS SITS, AND WHAT IT IS NOT ──────────────────────────────────────
// Three questions, three owners:
//
//   THIS      does every artifact the runtime needs EXIST and resolve?
//             Free, no docker, runs anywhere.
//   T's smoke does it BUILD, START, and answer?  ← the authority on "it works"
//   S's CI    is that still true tomorrow, unattended?
//
// 🔴 This is NECESSARY AND NOT SUFFICIENT. A green run here means "nothing is
// obviously missing", never "it boots". It cannot see a bad base image, a failed
// `npm ci`, or a module that throws on load. **S's CI should INVOKE T's smoke
// rather than rebuild it, and this in front of it rather than instead of it.**
//
// Why it exists at all: three C5 blockers in a row were the same sentence — the
// channel is missing a file the runtime needs — and each was invisible until the
// previous was fixed. config.yaml unparseable · a COPY source absent · a
// required sidecar never written. Each cost a full install-test cycle on real
// hardware to discover. All three are detectable from a checkout in under a
// second, which is what this does.
//
// Usage:  node scripts/verify-channels.mjs [channel ...]     (default: both)
// Exit 0 = every static check passes. Exit 1 = at least one fails.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const channels = process.argv.slice(2).length ? process.argv.slice(2) : ['chickadee', 'chickadee_dev'];

const results = [];
const record = (channel, check, ok, detail) => results.push({ channel, check, ok, detail });

function walk(dir, filter, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, filter, out); }
    else if (filter(p)) out.push(p);
  }
  return out;
}

/** A YAML parser, or null. Refuses to pretend — an unavailable parser is a FAILED
 *  check, never a silent pass: that is exactly how the unparseable config shipped. */
function findPython() {
  for (const c of [path.join(repoRoot, '.venv/bin/python'),
                   path.join(process.env.HOME || '', 'projects/dashieapp_staging/scripts/brand-gen/.venv/bin/python'),
                   'python3']) {
    try { execFileSync(c, ['-c', 'import yaml'], { stdio: 'ignore' }); return c; } catch { /* next */ }
  }
  return null;
}

for (const ch of channels) {
  const dir = path.join(repoRoot, ch);
  if (!existsSync(dir)) { record(ch, 'channel exists', false, `${ch}/ not found`); continue; }

  // 1. YAML parses (blocker #1). A bare scalar ends at its first ": ".
  const py = findPython();
  const yamls = [path.join(dir, 'config.yaml'), path.join(repoRoot, 'repository.yaml')].filter(existsSync);
  if (!py) {
    record(ch, 'yaml parses', false, 'no PyYAML available — refusing to report unchecked config as green');
  } else {
    const script = `
import sys, yaml
bad = []
for f in sys.argv[1:]:
    try: yaml.safe_load(open(f, encoding='utf-8'))
    except yaml.YAMLError as e:
        m = getattr(e, 'problem_mark', None)
        bad.append(f"{f}: {getattr(e,'problem',e)}" + (f" (line {m.line+1}, col {m.column+1})" if m else ""))
print("\\n".join(bad))`;
    const out = execFileSync(py, ['-c', script, ...yamls], { encoding: 'utf8' }).trim();
    record(ch, 'yaml parses', !out, out || `${yamls.length} file(s)`);
  }

  // 2. Every Dockerfile COPY source is in the build context (blocker #2).
  const df = path.join(dir, 'Dockerfile');
  if (existsSync(df)) {
    const missing = [];
    readFileSync(df, 'utf8').split('\n').forEach((line, i) => {
      const m = line.trim().match(/^COPY\s+(?:--\S+\s+)*(.+)$/);
      if (!m || /--from=/.test(line)) return;
      const parts = m[1].split(/\s+/);
      for (const src of parts.slice(0, -1)) {
        if (src.includes('*') || src.includes('?')) continue;
        if (!existsSync(path.join(dir, src))) missing.push(`Dockerfile:${i + 1} "${src}"`);
      }
    });
    record(ch, 'COPY sources present', !missing.length, missing.join(', ') || 'all present');
  }

  // 3. Every relative require/import resolves (blocker #3).
  const EXT = ['', '.js', '.json', '.mjs', '.cjs', '/index.js', '/index.json'];
  const unresolved = [];
  for (const abs of walk(path.join(dir, 'server'), (p) => /\.(js|mjs|cjs)$/.test(p))) {
    const d = path.dirname(abs);
    readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?:require\(|from\s+)['"](\.[^'"]+)['"]/g)) {
        if (!EXT.some((e) => existsSync(path.join(d, m[1] + e)))) {
          unresolved.push(`${path.relative(dir, abs)}:${i + 1} "${m[1]}"`);
        }
      }
    });
  }
  record(ch, 'requires resolve', !unresolved.length, unresolved.slice(0, 5).join(', ') || 'all resolve');

  // 4. The brain bundle and its BOOT-REQUIRED sidecar both exist (blocker #3).
  const bundle = path.join(dir, 'server/brain/voice-brain.bundle.js');
  const meta = path.join(dir, 'server/brain/voice-brain.bundle.meta.json');
  record(ch, 'brain bundle + sidecar', existsSync(bundle) && existsSync(meta),
    existsSync(bundle) ? (existsSync(meta) ? 'both present' : '🔴 sidecar MISSING — the add-on boots and exits(1)')
                       : '🔴 bundle missing');

  // 5b. 🔴 THE THREE NAMES THAT MUST AGREE. The add-on's discovery SERVICE, the
  //     `discovery:` list in config.yaml, and the vendored integration's own
  //     domain are one value in three places. Any disagreement is silent-ish and
  //     nasty: Supervisor 403s an add-on publishing a service its config does not
  //     declare (repeating every worker cycle), and the installer would target a
  //     directory HA never loads.
  //
  //     This is the producer/recogniser shape of lint:wire-values, applied where
  //     the add-on and its integration meet.
  {
    const disc = path.join(dir, 'server/discovery.js');
    const cfg = path.join(dir, 'config.yaml');
    const vend = path.join(dir, 'integration/custom_components');
    let svc = null, declared = [], domain = null;
    if (existsSync(disc)) svc = (readFileSync(disc, 'utf8').match(/SERVICE\s*=\s*['"]([^'"]+)['"]/) || [])[1] ?? null;
    if (existsSync(cfg)) {
      const m = readFileSync(cfg, 'utf8').match(/^discovery:\s*\n((?:\s*-\s*\S+\n)+)/m);
      if (m) declared = m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    }
    if (existsSync(vend)) {
      const pkgs = readdirSync(vend).filter((n) => existsSync(path.join(vend, n, 'manifest.json')));
      if (pkgs.length === 1) domain = pkgs[0];
    }
    const agree = svc && domain && declared.includes(svc) && svc === domain;
    record(ch, 'discovery names agree', !!agree,
      agree ? `${svc} (SERVICE = config.yaml discovery = vendored domain)`
            : `SERVICE=${svc ?? '?'} · config.yaml declares [${declared.join(', ') || '—'}] · vendored domain=${domain ?? '?'}`);
  }

  // 5. The vendored integration carries a manifest — an empty dir would satisfy
  //    the COPY check while shipping no integration at all.
  const vendored = path.join(dir, 'integration/custom_components');
  let ok = false, detail = 'integration/ absent';
  if (existsSync(vendored)) {
    const pkgs = readdirSync(vendored).filter((n) => statSync(path.join(vendored, n)).isDirectory());
    const withManifest = pkgs.filter((n) => existsSync(path.join(vendored, n, 'manifest.json')));
    ok = withManifest.length > 0;
    detail = ok ? `${withManifest.join(', ')} (manifest present)` : `${pkgs.length} dir(s), no manifest.json`;
  }
  record(ch, 'vendored integration', ok, detail);
}

const w = Math.max(...results.map((r) => r.check.length));
let failed = 0;
let lastCh = null;
for (const r of results) {
  if (r.channel !== lastCh) { console.log(`\n${r.channel}`); lastCh = r.channel; }
  if (!r.ok) failed++;
  console.log(`  ${r.ok ? '✅' : '❌'} ${r.check.padEnd(w)}  ${r.detail}`);
}

console.log(
  failed
    ? `\n❌ ${failed} static check(s) failed — do not spend a build on this tree.`
    : `\n✅ every static check passes for ${channels.join(', ')}.\n` +
      `   This means "nothing is obviously missing", NOT "it boots" — the build/start/probe\n` +
      `   smoke is the authority on that, and this runs in front of it, not instead of it.`,
);
process.exit(failed ? 1 : 0);
