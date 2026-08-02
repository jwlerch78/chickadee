# Bundled wake-word models

Two custom [microWakeWord](https://github.com/kahrendt/microWakeWord) models, plus
their manifests:

| File | Wake word | Selected by |
|---|---|---|
| `chickadee.tflite` / `.json` | "Chickadee" | `chickadee` — the default |
| `hey_dashie.tflite` / `.json` | "Hey Dashie" | `hey_dashie` — selectable alternative |

`hey_dashie` is named after **Dashie**, the paid family-dashboard product this
codebase is shared with. It ships here because the weights are a real trained
artifact and the id is a stored setting — removing it would silently unset the
wake word for anyone who had chosen it, and gain nothing. Shipping wake words
named after products is the ecosystem norm: openWakeWord ships `alexa`,
microWakeWord ships `okay_nabu`.

Nothing selects one for you beyond the default, and which you pick changes
nothing about where your audio goes.

The community models (Okay Nabu, Hey Jarvis, Alexa) ship with the official
`wyoming-microwakeword` add-on and are referenced by name, so nothing here has to
bundle them.

## Provenance

Both models were **trained in-house by Dashie** and are redistributed here under
this repository's licence. They are original models, not derivatives or re-labels
of a community model. See
[PROVENANCE.md](https://github.com/jwlerch78/chickadee/blob/main/PROVENANCE.md)
for the relationship between the two brands.

Attribution, not advertising: naming the trainer is how you can tell where the
weights came from.

They share the tensor signature of the community `okay_nabu` model, which is why
they load unmodified on the official `rhasspy/wyoming-microwakeword` add-on.

**The training pipeline is not yet public.** The weights here are the complete,
runnable artifact — nothing about using, inspecting, or redistributing them
depends on the trainer — but if you want to *reproduce* them, you can't do that
from this repo today. Said plainly rather than left to be discovered.

## Licence

The weights are released under this repository's **AGPL-3.0-only**, the same as
the rest of this integration. See [LICENSE](../LICENSE).

## Deployment

`satellite_wake.py` copies the selected model's `.json` + `.tflite` into
`/share/microwakeword/` so the `wyoming-microwakeword` add-on can load them via
`--custom-model-dir`. Only these custom words deploy anything — community wake
words are referenced by name and already ship with that add-on. The user-facing
description of this write is in
[the add-on's DOCS.md](https://github.com/jwlerch78/chickadee/blob/main/chickadee/DOCS.md#permissions-and-why-each-one).

<!-- Links to the add-on repo are absolute on purpose: this file ships at two
     different depths (canonical in the integration, and vendored into the
     add-on image), so a relative path can only ever resolve in one of them. -->
