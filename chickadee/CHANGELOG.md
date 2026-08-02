# Changelog

Chickadee starts its own history here. The add-on shares a codebase with Dashie
and most of this tree is generated from it, but Dashie's release history is not
Chickadee's — see `PROVENANCE.md` in the repository for the relationship.

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
