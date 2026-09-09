# Testing: headset + emulator QA

## Layers of QA

1. **Unit / logic** — locomotion math, save settings, UI state (Node/browser without HMD)
2. **Emulator** — WebXR API Emulator (Chrome/Firefox extensions) for session smoke, controllers, poses
3. **Headset smoke** — enter/exit session, both controllers, recenter, teleport
4. **Headset soak** — 10–20 minutes thermal + comfort
5. **Device matrix** — per docs/shipping

## Emulator checklist

- [ ] isSessionSupported true when emulator on
- [ ] Enter VR from user gesture
- [ ] Stereo views render (no single-eye black)
- [ ] Controller rays visible; select fires
- [ ] Thumbstick axes mapped for loco (if applicable)
- [ ] Session end returns to page UI

Emulators do not prove performance, thermals, or true comfort.

## Headset checklist

- [ ] Fresh load over HTTPS
- [ ] Permission / policy OK inside any iframe shell
- [ ] Guardian/bounds respected; no forced world penetration
- [ ] Snap turn + teleport (Tier A)
- [ ] Continuous loco if enabled (Tier C) flagged in settings
- [ ] Audio spatialization present
- [ ] Haptics pulse on select when hardware supports
- [ ] Recenter / seated height
- [ ] inputsourceschange (drop/reconnect battery controllers)
- [ ] Hand tracking path if advertised (optional feature)
- [ ] Interactive props: hover / use / grab; activity states; collider debug vs hero mesh ([quality-bar](../../studio/quality-bar.md) interactive assets)
- [ ] Exit VR cleanly; can re-enter without reload

## Automation notes

- Prefer screenshot/visual diffs for inline canvas; immersive automation is limited.
- Record manual test runs with build SHA, device OS, browser version.

## Bug triage labels

comfort · perf-frame · tracking-loss · input-binding · shipping-https · a11y
