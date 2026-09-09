# Stack: when to use what

Decision guide for WebXR VR apps. Pair with studio/adr/0001-framework.md.

## Comparison

| Stack | Best when | Tradeoffs |
| --- | --- | --- |
| Three.js | Custom VR apps, tight control, large ecosystem | You own UX/interaction glue |
| React Three Fiber (R3F) | React teams, declarative scenes, shared web UI | React reconcile cost; careful with per-frame work |
| Babylon.js | Batteries-included XR (WebXR default experience helpers), strong tooling | Heavier; opinionated scene graph |
| A-Frame | Fast prototypes, HTML-first authors, education | Less ideal for complex app architecture |
| Raw WebGL + WebXR | Engine authors, extreme control | High cost; easy to miss comfort/perf footguns |

## WebGPU

WebGPU is maturing for high-end rendering on the web. For **immersive WebXR** in 2026, production VR paths still predominantly present via WebGL/WebGL2 into XRWebGLLayer (or Layers WebGL binding). Treat WebGPU as:

- Great for desktop preview, baking, compute, and future XR backends
- Experimental for headset presentation until your target browsers document XR + WebGPU interop you can test

Do not block a VR ship on WebGPU-only presentation.

## Studio default

See ADR 0001: Three.js + Vite for product apps; A-Frame allowed for spikes; Babylon when the team wants built-in XR experience managers and GUI; R3F when the product is already React-centric.

## Integration notes

- Prefer engine WebXR helpers that wrap requestSession / reference spaces / controllers, but keep MDN mental model so you can debug outside the helper.
- Keep a thin "XR session service" boundary so swapping engines does not rewrite product code.
- Lock dependency versions in apps; document headset QA against that lockfile.
