# SPDX-License-Identifier: AGPL-3.0-only
"""Chickadee Voice gateway — the /api/chickadee_voice/voice/* views for LAN devices.

Ported from the Chickadee integration's voice_view.py. A satellite on the LAN
(any device holding an HA token — Chickadee tablets in kiosk mode today) reaches
household voice through these views; they proxy to the Chickadee add-on's
/api/internal/* (account credential, sharing gate) and to the cloud brain on
the account's behalf.

Every view serves TWO paths: the canonical `/api/chickadee_voice/...` and
`/api/chickadee/...`. Both hit the same handler.

⚠️ The second is NOT merely a legacy alias, though it was described as one here
for a while and that description nearly got it deleted from a branded build. It
is the CROSS-INTEGRATION CANONICAL PATH: the device integration serves
`/api/chickadee/voice/*` natively, and this integration claims the same path on top
of its own — which is exactly why the cede handshake below has to exist. Remove
it and cede leaves that path served by NOBODY: the device half stands down, this
half never claims it, and a caller gets a 404 with both integrations healthy.

It is also a compatibility contract with shipped Chickadee apps (a path is a wire
value — same rule as the `chickadee_cloud` engine id), so it must never be removed
while those apps are in the field. Two reasons, either one sufficient. Ownership: when the Chickadee Voice integration is
configured it registers these views and the Chickadee integration cedes (its
__init__ checks our config entries); see async_register_voice_views.

The payload builder FORWARDS the caller's body wholesale and overrides only the
keys it owns (GATEWAY_OWNED_KEYS, which mirror VoiceRequest field names). It is
deliberately not an allowlist: naming each forwarded field means the builder
silently drops every field added to the brain contract afterwards — that cost
device tool capability, the user's timezone, and anti-recursion state, with no
error and no log. Add a key here only to OVERRIDE it, never to permit it.

A sibling copy of this builder ships in the Chickadee integration, and the lint
that guards this shape currently checks that copy only — so keep the two in
step by hand until it covers this file too.
"""
from __future__ import annotations

import json
import logging

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .brain_target import cloud_base, default_brain_route
from .addon_bridge import AddonUnavailable, SharingDisabled
from .addon_voice import (
    converse_local,
    get_addon_availability,
    get_voice_config,
    mint_live_token,
    request_lease,
)
# ⚠️ THE ACCOUNT LANE — this one import is the whole of it in this file, and a
# build with no account drops this line together with the views below that use it.

_LOGGER = logging.getLogger(__name__)



# WHERE the brain is lives in brain_target.py — the one module that knows, and
# the seam a second brand differs at. Don't re-derive an endpoint here.



#: VoiceRequest keys the GATEWAY computes; everything else passes through.
GATEWAY_OWNED_KEYS = frozenset({"endpoint_id", "options", "client_fulfilled_tools"})
#: `options` keys read here, never sent on.
GATEWAY_INTERNAL_OPTION_KEYS = frozenset({"route"})
#: Retention pinned for EVERY caller — 'server' would move family speech off this box.
GATEWAY_RETAIN_MODE = "caller"


def build_brain_payload(body: dict) -> tuple[dict, str, str | None]:
    """Build the brain payload from a caller's request body (pure; pass-through).

    Returns `(payload, endpoint_id, route)`; `route` is popped from options
    (gateway-internal cloud-vs-local selector).
    """
    payload = dict(body or {})

    endpoint_id = payload.get("endpoint_id") or "ha-voice"
    payload["endpoint_id"] = endpoint_id

    raw_options = payload.get("options")
    options = dict(raw_options) if isinstance(raw_options, dict) else {}
    route = options.get("route")
    for key in GATEWAY_INTERNAL_OPTION_KEYS:
        options.pop(key, None)
    options["retain_mode"] = GATEWAY_RETAIN_MODE
    payload["options"] = options

    # A declared capability list (even empty) wins; only a caller that declares
    # NOTHING gets the headless default — the brain reads a missing field as
    # "fulfills everything", right for a tablet, wrong for a satellite.
    declared = payload.get("client_fulfilled_tools")
    payload["client_fulfilled_tools"] = declared if isinstance(declared, list) else []

    return payload, endpoint_id, route




class ChickadeeVoiceConverseView(HomeAssistantView):
    """Authed by the HA token; calls the brain on the account's behalf."""

    url = "/api/chickadee_voice/voice/converse"
    extra_urls = ["/api/chickadee/voice/converse"]  # cross-integration path (see module docstring)
    name = "api:chickadee_voice:voice:converse"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]

        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            return web.json_response({"ok": False, "error": "invalid_json"}, status=400)

        text = (body or {}).get("text")
        if not text or not isinstance(text, str):
            return web.json_response({"ok": False, "error": "text_required"}, status=400)

        payload, endpoint_id, route = build_brain_payload(body)

        # Authoritative account route stamped on every response so a device with
        # a stale cached route self-corrects next turn (brain-route strand fix).
        # An unreadable config yields no route at all rather than a guessed
        # "cloud" — this build's own default then applies (brain_target).
        authoritative_route = (await get_voice_config(hass)).get("route") or default_brain_route()
        # Both header names carry the same value. The first is this integration's
        # canonical, brand-parameterised name; the second is a WIRE VALUE that is
        # the same in every brand because the app reads that exact literal and
        # does not key it by edition.
        #
        # ⚠️ Do not "clean up" the second as legacy. A branded build once dropped
        # it and the brain-route keystone went inert: the response then carries no
        # header the device recognises, so a device holding a cached route strands
        # permanently, with both ends healthy. Same class as the extra_urls drop
        # (CONTRACTS #63) — a compat name is a contract, not clutter.
        route_header = {
            "X-Chickadee-Brain-Route": authoritative_route,
            "X-Dashie-Brain-Route": authoritative_route,
        }

        if route is None:
            route = authoritative_route
        # A caller can still ASK for the cloud explicitly. Honour that only if
        # this build has a cloud — otherwise the request would fall through to a
        # lane that does not exist here. Coerce to the brain this build actually
        # has, and say so, rather than failing at the far end of a dead path.
        #
        # Brand-neutral on purpose: in a build with a cloud this never fires, and
        # in a build without one it makes the cloud tail below UNREACHABLE — which
        # is what lets a no-account build drop that tail without changing any
        # behaviour, instead of merely hoping nothing reaches it.
        if route == "cloud" and not cloud_base():
            _LOGGER.warning(
                "DROP: caller asked for brain route 'cloud'; this build has no cloud brain — using the add-on"
            )
            route = "local"
        if route == "local":
            try:
                turn, status = await converse_local(hass, payload)
            except SharingDisabled:
                return web.json_response({"ok": False, "error": "sharing_disabled"}, status=403, headers=route_header)
            except AddonUnavailable as err:
                return web.json_response({"ok": False, "error": f"addon_unavailable: {err}"}, status=503, headers=route_header)
            return web.json_response(turn, status=(200 if status < 400 else status), headers=route_header)

        _LOGGER.warning("DROP: converse reached the cloud lane in a build that has no cloud brain")
        return web.json_response(
            {"ok": False, "error": "no_cloud_brain"}, status=501, headers=route_header
        )



class ChickadeeVoiceStatusView(HomeAssistantView):
    """Capability probe — can this HA offer household cloud voice to LAN endpoints?"""

    url = "/api/chickadee_voice/voice/status"
    extra_urls = ["/api/chickadee/voice/status"]  # cross-integration path (see module docstring)
    name = "api:chickadee_voice:voice:status"
    requires_auth = True

    async def get(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        status: dict = {}
        # ⚠️ ACCOUNT LANE — this ONE line is the whole of it here. It fully
        # answers the availability question when present (signed in? sharing on?
        # which email?), which is why the base probe below is a FALLBACK and not
        # a first step: a build with an account must not pay for both.
        if not status:
            # No account lane in this build: "available" means what it can mean
            # here — the add-on is reachable.
            status = await get_addon_availability(hass)
        agent_mode = ""
        retrieve_pictures = None
        brain_route = ""
        brain_route_reason = ""
        cfg: dict = {}
        try:
            cfg = await get_voice_config(hass)
            agent_mode = cfg.get("agent_mode", "") or ""
            if isinstance(cfg.get("retrieve_pictures"), bool):
                retrieve_pictures = cfg["retrieve_pictures"]
            if cfg.get("route") in ("local", "cloud"):
                brain_route = cfg["route"]
                brain_route_reason = cfg.get("route_reason", "") or ""
        except Exception:  # noqa: BLE001 — never fail the status probe on config
            agent_mode = ""
            cfg = {}
        body = {
            "available": bool(status.get("available")),
            "reason": status.get("reason", "unknown"),
            "agent_mode": agent_mode,
            # Which hub serves this household's voice gateway. The Chickadee
            # integration's copy of this view has no such field (absent =
            # chickadee), so shared devices can brand their "manage in ..."
            # strings correctly. New nullable field — old APKs ignore it.
            "hub": "chickadee_voice",
        }
        account_email = status.get("account_email")
        if isinstance(account_email, str) and account_email:
            body["account_email"] = account_email
        if retrieve_pictures is not None:
            body["retrieve_pictures"] = retrieve_pictures
        if brain_route:
            body["brain_route"] = brain_route
            body["brain_route_reason"] = brain_route_reason
        for key in ("default_personality_id", "default_voice_key", "default_wake_word"):
            val = cfg.get(key)
            if isinstance(val, str) and val:
                body[key] = val
        pipeline = cfg.get("pipeline")
        if isinstance(pipeline, dict) and pipeline:
            body["pipeline"] = pipeline
        model = cfg.get("model")
        if isinstance(model, str) and model:
            body["model"] = model
        return web.json_response(body)






class ChickadeeVoiceLiveTokenView(HomeAssistantView):
    """Broker a Live-only Gemini ephemeral token from the box's stored key."""

    url = "/api/chickadee_voice/voice/live-token"
    extra_urls = ["/api/chickadee/voice/live-token"]  # cross-integration path (see module docstring)
    name = "api:chickadee_voice:voice:live-token"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            body = {}
        model = (body or {}).get("model")
        model = model if isinstance(model, str) and model else None

        try:
            result, status = await mint_live_token(hass, model)
        except AddonUnavailable as err:
            return web.json_response({"ok": False, "error": f"addon_unavailable: {err}"}, status=503)

        return web.json_response(result, status=(200 if status < 400 else status))


class ChickadeeVoiceLeaseView(HomeAssistantView):
    """Capability lease — issue and renew (CONTRACTS #65).

    A satellite cannot reach the add-on directly (that needs the bridge secret,
    which a satellite must never hold), so the lease rides the authenticated LAN
    path that already exists: this gateway. We proxy and decide nothing.

    🔴 The add-on's STATUS is passed through untouched, because the status IS the
    protocol: 200 granted · 403 a definite refusal, self-destruct now · 503 the
    grant state is UNKNOWN, keep the lease and retry until expiry. Collapsing 403
    and 503 into one error would either revoke the household on every add-on
    restart, or never revoke at all.
    """

    url = "/api/chickadee_voice/voice/lease"
    extra_urls = ["/api/chickadee/voice/lease"]  # cross-integration path (see module docstring)
    name = "api:chickadee_voice:voice:lease"
    requires_auth = True

    async def post(self, request: web.Request) -> web.Response:
        hass: HomeAssistant = request.app["hass"]
        try:
            body = await request.json()
        except Exception:  # noqa: BLE001
            body = {}

        payload: dict = {"endpoint_id": (body or {}).get("endpoint_id") or "ha-voice"}
        caps = (body or {}).get("capabilities")
        if isinstance(caps, list):
            payload["capabilities"] = [c for c in caps if isinstance(c, str)]

        result, status = await request_lease(hass, payload)
        return web.json_response(result, status=status)


def register_voice_views(hass: HomeAssistant) -> None:
    """Register the gateway views (call only via async_register_voice_views)."""
    hass.http.register_view(ChickadeeVoiceConverseView())
    hass.http.register_view(ChickadeeVoiceStatusView())
    hass.http.register_view(ChickadeeVoiceLiveTokenView())
    hass.http.register_view(ChickadeeVoiceLeaseView())
    _LOGGER.info("Registered Chickadee Voice gateway views (/api/chickadee_voice/voice/* + legacy /api/chickadee/voice/* aliases)")
