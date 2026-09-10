# Quest 3 on-device QA

How a human records **real** Meta Quest 3 + **Meta Quest Browser** numbers for the studio gate. This page is the harness + checklist. **Do not invent timings.** Cells stay blank until someone fills them on a headset.

Gate policy: [quest-3-target](quest-3-target.md) — **90 Hz** ship / **72 Hz** fallback / 120 stretch. Never require 207/240 Hz.

Runnable slice: [`examples/interactive-prop`](../../examples/interactive-prop/). Press **`P`** (or the diag button) for the overlay. Overlay **off** = ~zero extra cost. Overlay **on** samples rAF Δ into a preallocated ring; that is an **approximate frame ms**, not Meta’s compositor HUD.

## Before you start

1. Flash/build the example over **HTTPS** (Vite `dev` on port 5174, or `preview`).
2. Open the URL in **Quest Browser** on **Quest 3** (Quest 3S is in-family smoke).
3. Note **Browser version** (Quest Browser settings / UA) and **OS / firmware** (Settings → System → Software).
4. Record the **git SHA** you loaded (`git rev-parse HEAD` on the machine that served the build).
5. Enter VR from a **user gesture** (Enter VR). Desktop / emulator is smoke — do not put emulator numbers in the results table.
6. **Frame-loop allocation scrub** (pre-headset authoring gate): with the `P` overlay **off**, the XR rAF path must not `new` vectors/arrays or call `intersectObjects`. `crate-toolbox` v0.8 is the reference scrub. This does **not** count as a 90 Hz measurement.

## Frame rate (`supportedFrameRates` / `updateTargetFrameRate`)

Real APIs only ([MDN `updateTargetFrameRate`](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/updateTargetFrameRate), [MDN `supportedFrameRates`](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/supportedFrameRates), [Meta: WebXR frame rate](https://developers.meta.com/horizon/documentation/web/webxr-frames/)).

Studio request on `sessionstart`: **90 if listed, else 72, else the UA default.** The example does not call `updateTargetFrameRate(120)` and must not require 207/240.

**How to read it**

1. Enter VR on `interactive-prop`.
2. After exit (or on the 2D page), open the **`P` overlay**. It shows:
   - **supported** — `Array.from(session.supportedFrameRates)` captured at `sessionstart`, or `n/a` if the UA omitted the API
   - **requested** — `90` or `72` if the example called `updateTargetFrameRate`, else `n/a`
   - **session.frameRate** — current rate **only if** `XRSession.frameRate` is a number after the call; otherwise `n/a` (do not assume 90)
3. Confirm the same lines in the browser console: `[interactive-prop] target frameRate … supported: …`
4. **Feel:** does motion stay smooth at the requested rate, or does it sag toward 72 / judder? Write that in “observed Hz feel” — qualitative is fine when you lack a compositor readout.

Missing APIs on desktop or older Browser: overlay stays `n/a`. That is not a 90 Hz pass.

## FFR (`fixedFoveation`)

Studio start: **0.5–1.0** (example sets **0.75** via `renderer.xr.setFoveation`). Spec: [MDN `XRWebGLLayer.fixedFoveation`](https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/fixedFoveation), [Meta FFR](https://developers.meta.com/horizon/documentation/web/webxr-ffr/).

**How to confirm**

1. After `sessionstart`, the overlay **FFR** row is `renderer.xr.getFoveation()` when that helper exists, else the value last passed to `setFoveation`, else `n/a`.
2. In-headset: periphery should look slightly softer than the center at 0.75. If the UA ignores FFR, the getter may still report the set value — say so in notes; do not treat a set() call as proof the GPU applied it.
3. Optional A/B: temporarily set 0.5 vs 1.0 and note comfort / aliasing. Do not change the ship default in the example unless the matrix says so.

## Hands (hover before pinch)

Optional `hand-tracking` on Quest 3 + Quest Browser (`crate-toolbox` v0.9). Controllers still win if a target-ray hits a hull this frame. This is **input parity**, not a frame-time measurement. Do not invent matrix numbers.

**How to confirm (qualitative)**

1. Enter VR. Set controllers aside (or keep rays off the crate) so the animation loop has no controller hover.
2. Rest or point an **index fingertip** on the latch, lid, grab hull, or — when `open` — the tool / fastener. Do **not** pinch yet.
3. **Pass:** the matching part gets the same emissive hover as a controller ray. **Fail:** nothing highlights until pinch (v0.8).
4. Pinch still maps to the same intents as today (use-layer → use, grab-layer → grab, fastener → drive/nack). Hover must not use, grab, or drive.
5. If a controller ray is also on a hull, that hover wins. Switching sources should not flicker the highlight every frame.

Leave the results table blank. Note “hand hover before pinch: pass/fail” in the Notes cell only after a real headset run.

## ≥10 minute thermal soak

Use the **interactive-prop** crate (`crate-toolbox`), not an empty scene.

1. Enter VR. Confirm overlay / console captured rates + FFR (then you may hide the overlay with `P` so sampling cost is ~zero).
2. For **at least 10 minutes** wall-clock: grab and move the crate, latch → cancel, latch → lid open, extract tool, drive the fastener, return tool, reset. Look around the room so both eyes see the table and floor.
3. Watch for: thermal throttle (frame-ms overlay rising if you turn `P` on again), 90→72 feel, session end, or Guardian/reprojection artifacts.
4. Fail the row if the hero view cannot hold the **requested** rate for the soak, or if you must drop to 72 to stay comfortable — record 72 as **fallback**, not a silent pass.

Emulator minutes do not count.

## Approx frame ms method

Write the method you actually used in the table, for example:

| Method | Notes |
| --- | --- |
| Example `P` overlay | Mean rAF Δ over a 90-sample ring. **Approximate.** Not compositor time. |
| Quest Browser / Meta perf HUD | Prefer this when available; say which overlay. |
| Engine / Spector / `XRFrame` traces | Fine; name the tool. |

Leave **approx frame ms** blank if you did not measure. Do not copy desktop rAF into a Quest 3 row.

## Results table (blank until a headset run)

Copy a row per Browser + firmware + SHA. Leave cells empty rather than guessing.

| Date | Build SHA | Device | Browser version | OS / firmware | Requested Hz | Observed Hz feel | FFR value | Approx frame ms | Method | Soak ≥10 min | Pass / fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | Quest 3 |  |  | 90 (or 72) |  |  |  |  |  |  |  |

**Pass** means: requested rate held for the soak, FFR confirmed or explicitly noted as UA-ignored, no invented numbers, SHA + Browser + firmware filled.

Authoring estimates (LOD tris/draws, texture max) on the overlay and in `crate-toolbox` `perf` are **not** headset measurements.

## Related

- [quest-3-target](quest-3-target.md) — budgets and session snippet
- [quality-bar](../../studio/quality-bar.md) — Performance gate
- [testing](../testing/README.md) — emulator vs headset layers
