# Changelog

Chickadee starts its own history here. The add-on shares a codebase with Dashie
and most of this tree is generated from it, but Dashie's release history is not
Chickadee's — see `PROVENANCE.md` in the repository for the relationship.

## 0.1.5 — 2026-08-02

🔴 **The Chickadee panel opens.** On 0.1.4 and earlier it rendered blank — the
page tried to load six files that this edition removes on purpose, and the error
stopped it before anything appeared. If you installed Chickadee and got an empty
panel, this is that.

- The account, credits and scheduled-actions pages are genuinely absent here
  (there is no account), and the console no longer references them.
- Two menu items that could never have worked — "Sign Out" and "Delete
  account…" — are gone rather than sitting there doing nothing.

## 0.1.4 — 2026-08-02

**A new look.** Chickadee's mark is now orange. Nothing else changed — no
behaviour, no settings, no permissions.

## 0.1.3 — 2026-08-02

**Turning sharing off now reaches your devices in seconds.**

It always took effect — a satellite that could not renew its access fell back to
Home Assistant's own voice engines on its own. But the signal telling devices to
check *now* was being sent in a form Home Assistant would not deliver to a
non-administrator user, which is what a wall tablet usually is. So the change
quietly waited out the renewal window instead, up to half an hour.

- **The signal is now something every user can receive**, so a flip applies
  almost immediately rather than at the next renewal.
- **Nothing else changed about how access works.** The signal only says "check
  again"; the answer still comes from this box, the same way it always did.
- If your Home Assistant is set up so the tablet's user cannot see this add-on's
  entities, devices fall back to the slower path — they still get there.

## 0.1.2 — 2026-08-02

**Your provider keys are now only spent when you say so.**

Chickadee could already be told not to share voice and A.I. with the rest of the
house, but nothing actually checked that before spending — so a satellite could
keep using your stored provider keys after you had turned sharing off. It now
checks before every call that costs money, and Home Assistant's own voice
engines keep working either way, because they cost nothing.

- **The sharing switch is on the Voice & A.I. page**, and it works without a
  Dashie account. It is **on by default**: the person who stored the key and the
  person who set up the satellite are the same person here.
- **Turning it off applies to this whole box**, including this console — not
  just to satellites. The switch says so.
- **Changes take effect in seconds**, not after a wait. Devices are told
  immediately instead of finding out at their next check-in.
- A device that is refused **falls back to Home Assistant's engines** rather than
  going silent, and picks the shared brain back up when you turn sharing on or
  add a key.

## 0.1.1 — 2026-08-02

Fixes found by a fresh-box install test. Everything here was invisible on a
developer machine and only showed up on a real Home Assistant.

- **The add-on now installs and starts.** The image could not build (a missing
  vendored path), and once it built the brain exited at boot on a missing
  metadata file.
- **The voice integration installs.** The installer looked for a directory named
  for the other brand and silently found nothing, so a fresh box got no voice
  integration at all.
- **Supervisor discovery works**, so the integration receives the bridge secret
  instead of failing to authenticate. This also ends a 403 that repeated every
  worker cycle.
- **Video feeds, cameras, transcripts and the voice-config refresh work** — each
  was calling the integration by a hard-coded path belonging to the other brand.
- The add-on log now says Chickadee rather than another product's name.

## 0.1.0 — 2026-08-01

First beta.

- Voice and AI for Home Assistant with **no account and no hosted service**.
  Bring your own model (local or your own provider key); leave speech blank to
  use Home Assistant's own Whisper and Piper.
- Installs and updates the **Chickadee Voice** integration, and offers the core
  restart it needs to activate.
- Console in the Home Assistant sidebar for engine setup and provider keys.
- Ships the `chickadee` wake-word model as the default.

Known rough edges, stated rather than left to be discovered:

- The bridge secret lives in the Home Assistant config directory, so another
  add-on with a config mount could read it. Supervisor-discovery-only is planned.
- The in-assistant product help tool is not offered in this build: it answers
  from Dashie's product documentation, which would describe a different product.
  A Chickadee knowledge base is worth writing once there is something to write.
