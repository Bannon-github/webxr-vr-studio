# Shipping WebXR VR

## Device / browser matrix (maintain per release)

Fill this table for every release; do not ship with empty cells.

| Device | Browser | Mode | Status | Notes |
| --- | --- | --- | --- | --- |
| Meta Quest 2/3/3S/Pro | Meta Quest Browser | immersive-vr | Required | Primary standalone target |
| Desktop Windows | Chrome | Emulator / tethered (if avail.) | Required | Dev + smoke |
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
- [ ] Perf soak on lowest tier device
- [ ] Privacy policy covers camera/mic/hand if used
- [ ] Crash/analytics pipeline does not log secrets
- [ ] Rollback plan for CDN assets
