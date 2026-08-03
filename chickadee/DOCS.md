# Chickadee

Voice and AI for Home Assistant. Free, self-hosted, and there is no account —
nothing here asks you to sign up, and nothing phones home.

Chickadee gives Home Assistant's voice assistant a real brain: ask open questions,
control your home in plain language, and hear a natural voice back. You bring the
engines — a model running on your own hardware, or your own provider API key.

> **Beta.** This is early software. It works, and it will have rough edges. If
> something is broken, please open an issue on the repository — that is the
> support channel, and there is no other.

---

## What you need

**One thing: an AI model to think with.** Either

- **a local model** — Ollama, llama.cpp, or anything else that speaks the
  OpenAI-compatible chat API, running on your own hardware; or
- **an API key** from a provider you already use.

**Speech is optional.** Leave the speech-to-text and text-to-speech settings
blank and Chickadee uses Home Assistant's own — Whisper and Piper, the ones you
have already set up. Fill them in only if you want something different.

That is the whole requirement. Everything else has a working default.

**Optional: the Dashboards page.** The add-on's panel can list your tablets —
which are online, and their settings — but that list comes from the **Chickadee
integration**, which is a separate install from HACS. Without it the Dashboards
page is simply empty; voice works either way. Install it from HACS, then add each
tablet to it.

⚠️ That is a *different* component from the Chickadee **Voice** integration the
add-on installs for you (see `install_integration` below). One is bundled because
it has to match this add-on version; the other is independent and rides its own
release cadence.

---

## Setup

1. **Install and start the add-on.** Open the **Chickadee** panel that appears in
   your Home Assistant sidebar.
2. **Point it at a brain.** In the add-on's **Configuration** tab, set `llm_url`
   and `llm_model` (plus `llm_api_key` if your provider needs one). For Ollama on
   the same machine, `http://homeassistant.local:11434` and a model you have
   pulled is enough.
3. **Restart the add-on** so it picks up the configuration.
4. The add-on installs the **Chickadee Voice** integration for you and offers to
   restart Home Assistant, which the integration needs in order to activate.
   Turn `install_integration` off if you would rather manage it yourself.

Then talk to it — through a Home Assistant voice satellite, the Assist dialog, or
anything else that uses a Home Assistant pipeline.

---

## Configuration options

| Option | What it does |
|---|---|
| `llm_url` | An OpenAI-compatible model server. A base URL (we append `/v1/chat/completions`), or a full chat-completions URL for providers whose path differs. |
| `llm_model` | Which model to run. |
| `llm_api_key` | Bearer key. Leave blank for a local Ollama or llama.cpp. |
| `stt_url` · `stt_model` · `stt_api_key` | An OpenAI-compatible transcription server. **Blank = use Home Assistant's own speech-to-text.** |
| `tts_url` · `tts_voice` · `tts_api_key` | An OpenAI-compatible speech server. **Blank = use Home Assistant's own text-to-speech.** |
| `install_integration` | On (default): the add-on installs and updates the bundled Chickadee Voice integration. It never touches a HACS or manual install. |
| `log_level` | How much the add-on logs. |

Provider keys you enter in the console are stored in the add-on's own `/data`
directory and are excluded from Home Assistant backups.

---

## Where your data goes

**To the engines you configured, and nowhere else.**

- Point Chickadee at a model on your own hardware and no speech or text leaves
  your network.
- Point it at a provider and your requests go to that provider under your own
  key, on your own terms with them.
- There is no Chickadee account, no Chickadee server, and no telemetry. The
  add-on does not send your speech, your transcripts, or your usage anywhere.

The add-on talks to Home Assistant over the internal Supervisor network and
authenticates the integration with a shared secret it generates on first run.

---

## Permissions, and why each one

| Permission | Why |
|---|---|
| `hassio_api` | Publishes the bridge secret over Supervisor discovery, and lists installed add-ons so the console can detect speech engines you already run. |
| `homeassistant_api` | Reads Home Assistant's own engine list over the WebSocket API — the only place that information is available. |
| `hassio_role: manager` | The console's "Restart Home Assistant" button. The integration needs a core restart to activate, and the add-on offers it in one click rather than sending you to the CLI. |
| `homeassistant_config:rw` | Writes the bridge secret to `.chickadee/bridge_secret` so the integration can read it, and installs the integration into `custom_components/`. |
| `ingress` | Serves the console in your sidebar. Home Assistant proxies and authenticates it; nothing is exposed on your LAN. |

⚠️ Worth knowing: the bridge secret currently lives in the Home Assistant config
directory, which means any other add-on with a config mount could read it.
Moving it to Supervisor discovery alone is planned.

---

## Wake words

Chickadee ships a trained microWakeWord model named `chickadee`, which is the
default. Other wake words available to Home Assistant still work; nothing selects
one for you, and which you pick changes nothing about where your audio goes.

---

## Licence and provenance

Chickadee is AGPL-3.0. It shares a codebase with **Dashie**, a paid
family-dashboard product by the same maker, and most of this tree is GENERATED
from Dashie's sources rather than hand-maintained — see `PROVENANCE.md` in the
repository, which states the relationship plainly, including what is published
and what is not.
