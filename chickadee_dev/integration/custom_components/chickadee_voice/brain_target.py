# SPDX-License-Identifier: AGPL-3.0-only
"""WHERE the brain is — the one function that knows.

The gateway used to answer this three times over (`_cloud_base`, `_brain_url`,
`_stt_token_url` in voice_view.py), each reachable only by reading the function
above it. That is fine while there is one product. It stops being fine the moment
a second brand exists, because "where is the brain" is the thing that differs
between them — and a value that differs per brand, duplicated across call sites,
is the shape that breaks silently across a rename.

So this module owns the answer and nothing else. Deliberately NOT in
`addon_bridge`: `account_bridge` already imports `addon_bridge`, and this needs
both, so putting it there would be a cycle. It sits above both bridges, which is
also where it belongs conceptually.

WHAT THIS DOES NOT DO
---------------------
It does not POST. Callers still build their own request and handle their own
response, including the NDJSON streaming loop. That duplication is mechanical —
it does not rot across a rename — so consolidating it is a separate, larger
change that moves a shipped LAN-satellite path from "cloud with an account
credential" to "add-on that re-routes", and therefore owes an on-device run
before it can be called done. Tracked in the Chickadee repo's build plan.

THE BRAND SEAM IS ONE CONSTANT
------------------------------
`_FALLBACK_CLOUD_BASE`. A build with an account cloud names it; a build without
one sets it to None, and the add-on becomes the brain — which is already the
stated architecture ("the add-on owns engine routing (cloud / BYOK / local) and
key custody", const.py). Nothing else in the gateway needs to know which brand it
is running as.
"""
from __future__ import annotations

from homeassistant.core import HomeAssistant

from . import account_bridge
from .account_bridge import get_account_credential
from .addon_bridge import addon_brain_target

#: Fallback cloud base, used when the add-on is too old to report one. The
#: add-on is the real source (`account_bridge.cloud_url()`, populated on the
#: first sharing-status check); this is the floor under it.
#:
#: ⚠️ THIS CONSTANT IS THE BRAND SEAM. A build with no account cloud sets it to
#: None — that single change is what makes the add-on the brain for that build.
#: It is also self-policing: a branded variant that forgot to substitute it would
#: still carry this URL, and the generator's deny scan fails on exactly that.
_FALLBACK_CLOUD_BASE: str | None = None


def cloud_base() -> str | None:
    """The account cloud base, or None when this build has no cloud at all."""
    return account_bridge.cloud_url() or _FALLBACK_CLOUD_BASE


async def brain_target(
    hass: HomeAssistant, cred: str | None = None
) -> tuple[str, dict[str, str]]:
    """Where to POST a VoiceRequest, and how to authenticate to it.

    Returns (url, headers). Raises AddonUnavailable when there is no cloud and
    the add-on cannot be reached — which for a no-cloud build is the only brain
    there is, so failing loudly is correct.
    """
    base = cloud_base()
    if base:
        if cred is None:
            cred = await get_account_credential(hass)
        return f"{base}/functions/v1/voice-conversation", {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cred}",
            "apikey": cred,
        }

    # No cloud in this build: the add-on is the brain and owns engine routing.
    return await addon_brain_target(hass)
