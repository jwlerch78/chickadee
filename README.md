# Chickadee

A free, source-published **Home Assistant** edition of the Dashie dashboard and
voice assistant: HA kiosk, wake word, voice, cameras and music.

No account. No subscription. No metered service. Voice runs on Home Assistant's
own engines, or on provider keys you bring yourself, and it keeps working
offline.

## Install

This repository **is** the add-on repository — add the URL below to Home
Assistant and Chickadee appears in your add-on store.

1. **Settings → Add-ons → Add-on Store**, then **⋮ → Repositories**.
2. Add `https://github.com/jwlerch78/chickadee`.
3. Install **Chickadee**, and restart Home Assistant when it asks you to.

The add-on installs the voice integration for you; you do not add that one
separately. There are two channels — install **Chickadee** unless you were
asked to test **Chickadee (Dev)**, which carries pre-release builds. Both can
be installed side by side.

Related: [chickadee-integration](https://github.com/jwlerch78/chickadee-integration),
the integration for the Chickadee Android app on a tablet or TV ·
[chickadee-voice-integration](https://github.com/jwlerch78/chickadee-voice-integration),
the voice/Assist integration the add-on installs

## Provenance

Chickadee shares a codebase with **Dashie**, a paid family-dashboard product by
the same author. The Chickadee trees are **generated** from that codebase rather
than written here, so this repository's history is machine-authored — commits read
`Regenerate from <source> @ <sha>`, and there may be no human-authored commits at
all.

That is normal for a generated artifact, and it is stated here rather than left
to be discovered. The generator, its substitution tables and the checks that gate
them are part of the source it is generated from.

The full disclosure — including the brand's own history, which reversed twice and
is corrected by appending rather than by editing — is on the Dashie side, where
the source lives:
[PROVENANCE.md](https://github.com/jwlerch78/dashie-ha/blob/main/PROVENANCE.md).

## Licence

AGPL-3.0-only.
