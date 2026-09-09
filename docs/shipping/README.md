# Shipping WebXR VR

**Gate device:** [Quest 3](quest-3-target.md) — Meta Quest Browser, immersive-vr, **90 Hz**. Other rows in the matrix are coverage, not the performance bar.

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

1. **Progressive Web App** — installable shell, HTTPS, offline cache for shell assets (careful with large GLBs).
2. **Headset browser bookmark / home shortcut** — document first-run.
3. **Store wrappers** — only when product requires; keep web build as source of truth when possible.
4. **Versioned CDN assets** — immutable URLs for GLB/KTX2; cache-bust on content pipeline revisions.

## Release checklist

- [ ] Matrix filled and signed by QA
- [ ] Comfort tier defaults verified
- [ ] Quest 3 90 Hz soak (10+ min); 72 Hz fallback documented if used
- [ ] Privacy policy covers camera/mic/hand if used
- [ ] Crash/analytics pipeline does not log secrets
- [ ] Rollback plan for CDN assets
