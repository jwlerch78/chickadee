# Changelog — dev channel

Pre-release builds. Versions here move ahead of the prod channel; a prod release
is a promotion of a build that ran here first.

Chickadee starts its own history here. The add-on shares a codebase with Dashie
and most of this tree is generated from it, but Dashie's release history is not
Chickadee's — see `PROVENANCE.md` in the repository for the relationship.

## 0.1.3 — 2026-08-02

The renew-now signal moves to an entity state change, because the event form was
not deliverable to a non-admin Home Assistant user. Vendored integration 0.9.0.
See the prod channel's changelog for the user-facing summary.

## 0.1.2 — 2026-08-02

The household sharing switch now actually gates spending, and works without a
Dashie account. See the prod channel's changelog for the user-facing summary —
this build carries the same change, ahead of its promotion.

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
