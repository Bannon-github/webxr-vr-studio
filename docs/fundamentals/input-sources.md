# Input sources

Each XRInputSource describes a tracked controller, hands, or gaze/screen source.

## Discovery

- Live list: session.inputSources
- Listen for inputsourceschange to add/remove controller meshes and listeners
- handedness: left | right | none
- targetRayMode: gaze | tracked-pointer | screen

## Spaces

- targetRaySpace — origin/orientation of the pointing ray (for UI lasers, teleport arcs)
- gripSpace — where a held object should attach (may be null for some sources)

Query with frame.getPose(inputSource.targetRaySpace, refSpace).

## Primary actions (MDN)

Transient action events on XRSession:

- selectstart / select / selectend — primary activate (trigger / click)
- squeezestart / squeeze / squeezeend — grip / squeeze when supported

For continuous thumbstick/touchpad values, use the Gamepad object exposed via inputSource.gamepad (WebXR Gamepads Module) when present — axes/buttons mapping is profile-dependent; prefer declared profiles[] strings when choosing meshes and bindings.

## Profiles

inputSource.profiles is an ordered list of suggested visualization / binding profiles (e.g. vendor-specific then generic-trigger-squeeze-thumbstick). Match the first known profile in your asset pack.

## Hands

When hand-tracking was granted, inputSource.hand may expose XRHand joint spaces. Treat as optional enhancement; always keep controller fallback.

Refs: MDN Inputs and input sources; immersive-web webxr-samples input-selection.
