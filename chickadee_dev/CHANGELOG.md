# Changelog — dev channel

Pre-release builds. Versions here move ahead of the prod channel; a prod release
is a promotion of a build that ran here first.

Chickadee starts its own history here. The add-on shares a codebase with Dashie
and most of this tree is generated from it, but Dashie's release history is not
Chickadee's — see `PROVENANCE.md` in the repository for the relationship.

## 0.1.11 — 2026-08-03

**Voice & AI now tells you what is actually being shared — not just what the
switch is set to.**

The Shared voice & A.I. card has always shown a button reading "Sharing On" or
"Sharing Off". That is the setting. It is not the same as what a tablet or voice
satellite would actually be granted if it asked right now — sharing can be on
while nothing is configured to share, and the button looks identical either way.

A line under the switch now says which it is: that your Home Assistant's AI keys
are in use, that its built-in voice is, that sharing is off for this device, or
that no AI keys are set up and where to add them.

If the add-on cannot work the answer out, it says **nothing** rather than
guessing — an empty line there means "could not tell", never "nothing is shared".

## 0.1.10 — 2026-08-03

**The Devices page now tells you why it is empty, and what to do about it.**

0.1.9 put Devices in the sidebar. If you went there and found nothing, the page
said "No devices registered yet" and then told you to sign in — which this
edition has no way to do. It now says the real thing: devices appear once Home
Assistant has the Chickadee integration, you install that from HACS, and there
is no account to sign in to.

That integration is a **separate install** from the Chickadee **Voice**
integration the add-on sets up for you — a distinction nothing previously
explained. The add-on documentation now covers it under "What you need".

*Also in this build, with nothing you can see:* the add-on records which Home
Assistant service calls a stricter policy **would** refuse, without refusing
any of them. It is there to gather evidence before anything is enforced.

## 0.1.9 — 2026-08-03

**The Devices page is now reachable.**

0.1.8 made the Devices page work without an account, and then did not show it to
you: the page shipped inside the add-on but was still switched off for this
edition, so nothing you could click ever reached it. It is on now — you will find
Devices in the sidebar.

The page you land on has not changed; Voice & AI is still the home screen.

## 0.1.8 — 2026-08-03

**The Devices page works without a Dashie account — it lists your dashboards and
shows which are online.**

Chickadee's Devices page is the panel's home screen, and until now it was always
empty: it asked a cloud account for the list, and there is no account here. It now
builds the list from Home Assistant itself, which already knows your devices. A
device that is switched off still appears — under Offline, with its name — rather
than vanishing or turning into a blank card.

**Device controls work again too.** Screen on/off, volume, brightness, reload,
restart and the rest were refusing with a sign-in error, because they were checking
for a cloud account rather than for Home Assistant. Being signed in to Home
Assistant is what they check now, and each action is recorded in the add-on log with
the Home Assistant user who took it.

Screenshots and camera views are still unavailable in this edition; they are a
separate decision, not an oversight.

## 0.1.7 — 2026-08-02

**If you installed Chickadee before today, your voice integration had quietly
stopped updating. This fixes it — no action needed from you.**

The add-on marks the integration it installs with a small hidden file, and it
checks for that mark to know the integration is its own to manage. The mark's
name changed when the add-on was rebranded, so on boxes set up before that change
the add-on stopped recognising its own work: it concluded you had installed the
integration yourself, and politely left it alone from then on. Every later update
was skipped, and the log said it was leaving a manual install alone — which read
as correct, so nothing looked wrong.

It now recognises the mark whichever name it carries, and repairs the name as it
goes. Your integration updates on the next add-on start.

**Also:** removing a device from the Console now actually removes it, and offers
it back under "devices that can be added" so you can re-add it. Previously the
row was kept and the device kept its access.

## 0.1.6 — 2026-08-02

ACCOUNT_LOCKED_PAGES is emptied in the generated tree, as the table always
claimed. The locked-page renderer and both isLocked branches go with it.

## 0.1.5 — 2026-08-02

The console panel opens: dropped modules were still referenced by index.html and
the route table, so the SPA threw before rendering. See the prod changelog.

## 0.1.4 — 2026-08-02

The orange mark. Images only.

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
