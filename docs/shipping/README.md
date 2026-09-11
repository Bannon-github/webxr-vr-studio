# Shipping WebXR VR

**Gate device:** [Quest 3](quest-3-target.md) — Meta Quest Browser, immersive-vr, **90 Hz**. Other rows in the matrix are coverage, not the performance bar.

**New titles / Store:** [horizon-store/](horizon-store/) — interrogation + brief + VRC-oriented checklists before scaffold ([ADR 0006](../../studio/adr/0006-store-gate-before-build.md)). Does not replace this matrix.

## Device / browser matrix (maintain per release)

Fill this table for every release; do not ship with empty cells.

| Device | Browser | Mode | Status | Notes |
| --- | --- | --- | --- | --- |
| **Meta Quest 3** | Meta Quest Browser | immersive-vr | **Required (gate)** | 90 Hz ship; 72 Hz fallback; see [quest-3-target](quest-3-target.md) |
| Meta Quest 3S | Meta Quest Browser | immersive-vr | In-family | Same GPU class; smoke if you ship it |
| Meta Quest 2 / Pro | Meta Quest Browser | immersive-vr | Optional soak | Not the studio default |
| Desktop Windows | Chrome | Emulator / tethered (if avail.) | Required | Dev + smoke — not the perf gate |
| Desktop Windows | Edge | immersive-vr when device available | Secondary | Chromium parity |
| Pico / other | Vendor browser | immersive-vr | Optional | Track if product requires |
| Safari / visionOS | As documented by Apple for WebXR | Optional | Verify current support before promising |

WebXR is not Baseline; capabilities differ. Always call isSessionSupported at runtime.

## HTTPS and secure context

- Production must be HTTPS.
- Local dev: localhost is a secure context; for headset-on-LAN use HTTPS (Vite plugin, mkcert, or tunnel) because a phone/HMD visiting http://192.168.x.x is not a secure context.
- Mixed content will break XR and assets.

## Permissions and policy

- Permissions-Policy / Feature-Policy: xr-spatial-tracking must be allowed (critical for iframes).
- Immersive session requires user gesture + focused document.
- Do not auto-request sessions on page load.

## Distribution

Hosted WebXR, WebXR **Store PWA**, and native Unity/Unreal are different products. Lock the path in an [app brief](../../studio/briefs/_template/) before scaffolding ([ADR 0006](../../studio/adr/0006-store-gate-before-build.md), [webxr-vs-native](horizon-store/webxr-vs-native.md)).

1. **Hosted WebXR (this repo’s default for examples)** — HTTPS URL in Meta Quest Browser; bookmark / Web Launch. Not a Horizon Store listing.
2. **WebXR PWA** — optional Bubblewrap / TWA wrapper of that origin for the [Meta Horizon Store](https://developers.meta.com/horizon/documentation/web/pwa-overview/). Same VRC review as other APKs.
3. **Native Store APK** — Unity / Unreal / Spatial SDK. Out of this repo’s examples; still requires interrogation + store-gate if an agent is asked to start that title.
4. **Versioned CDN assets** — immutable URLs for GLB/KTX2; cache-bust on content pipeline revisions.

Store-bound titles: run [horizon-store/](horizon-store/) (requirements pass + DQ avoidance). Re-fetch Meta’s [VRC table](https://developers.meta.com/horizon/resources/publish-quest-req/). Do not claim approval from a green studio checklist.

## Release checklist

- [ ] New title: interrogation complete, brief schema-valid, store-gate `pass` or `n/a-browser-only` ([horizon-store](horizon-store/), [ADR 0006](../../studio/adr/0006-store-gate-before-build.md))
- [ ] Matrix filled and signed by QA
- [ ] Comfort tier defaults verified (studio A/B/C **and** Store Comfortable/Moderate/Intense if listing)
- [ ] Quest 3 90 Hz soak (10+ min); 72 Hz fallback documented if used — fill [quest-3-on-device-qa](quest-3-on-device-qa.md) (no invented ms)
- [ ] Privacy policy covers camera/mic/hand if used
- [ ] Crash/analytics pipeline does not log secrets
- [ ] Rollback plan for CDN assets
