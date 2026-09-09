# Asset-to-interaction workflow

End-to-end studio path from a photoreal brief to a WebXR prop that users can hover, grab, and drive through multi-step activities.

This is the **production** path. [`content-pipeline.md`](content-pipeline.md) is the shorter DCC → headset export checklist; this document owns generation choices, cleanup, realtime packaging, behavior, and QA. Architecture lives in [ADR 0004](adr/0004-asset-interaction-architecture.md). Interaction *feel* lives in [`docs/design/interactive-objects.md`](../docs/design/interactive-objects.md). Frame-budget photoreal lives in [`docs/performance/photoreal-realtime.md`](../docs/performance/photoreal-realtime.md). After the first shippable revision, grow the same `objectId` via [additive-object-iteration](additive-object-iteration.md) ([ADR 0005](adr/0005-additive-object-evolution.md)) — do not start a parallel folder “for the new look.”

**Invariant:** visual mesh, interaction collider, and behavior are three artifacts. Do not raycast or simulate against the hero mesh.

## 1. Brief and reference

Write the brief before any scan, prompt, or sculpt. A photoreal target without interaction goals produces a lookdev sculpture that fails in headset.

### Photoreal target

| Capture | Why it matters in XR |
| --- | --- |
| Real-world size (mm) and mass feel | 1 unit = 1 meter; seated reach and grip offset are wrong if scale is guessed |
| Material recipe | Base color / metalness / roughness / normal / AO (and emissive only if the object emits) |
| Lighting references | Same object in studio softbox **and** a dim interior; XR IBL is rarely the photographer’s HDR |
| Wear, dirt, edge highlights | Micro-contrast reads as “real” at arm’s length; 4K albedo does not |
| Silhouette from 0.4 m, 1.5 m, 4 m | LOD and FFR will erase the detail you only see in a DCC beauty shot |

Photograph or board **three** stills: hero close-up, in-context scale, and a “used by a hand” shot (grip, pour lip, latch). If you cannot show the hand contact, you do not have an interaction brief.

### Interaction goals

Answer these before generation:

1. **What is the user trying to finish?** (open, assemble, pour, operate a tool, inspect)
2. **How many committed states?** Name them (`closed` → `unlatched` → `open`). Illegal transitions are bugs, not “juice.”
3. **Which parts move?** Each moving part is its own node, collider, and usually its own activity.
4. **Grab vs use vs both?** A toolbox you pick up *and* unlatch needs a grab hull plus a latch trigger.
5. **Hands or controllers required?** Core loop must work with `select` / `squeeze` on tracked pointers ([ADR 0003](adr/0003-interaction.md)). Hand joints are an enhancement.
6. **Failure and reset?** What happens if they drop it mid-sequence, or recenter?

Store the brief on the object: `assets/objects/<objectId>/BRIEF.md` ([catalog](../assets/objects/README.md)). Copy it into the CDN snapshot `content/<project>/<revision>/BRIEF.md` at ship time.

## 2. Generation paths

Pick the path that matches **uniqueness of the object** and **how much topology you will throw away**. All three paths rejoin at cleanup.

| Path | Use when | Avoid when | Typical output debt |
| --- | --- | --- | --- |
| **Scan / photogrammetry** (RealityCapture, RealityScan, Polycam, studio turntable) | Unique real prop; legal to scan; material response is the product | Soft/furry/transparent/thin; you need clean mechanical motion | Dense scan mesh, bad topology, baked lighting in albedo, no usable UVs |
| **AI text-to-3D / image-to-3D** (current commercial mesh generators) | Blockout, set dressing volume, “we need 20 variants by Friday” | Hero interactive parts (hinges, threads, pour lips); anything with IP/likeness risk | Non-manifold mesh, 3–10 UV islands per tooth, PBR maps that do not match, hallucinated mechanics |
| **DCC sculpt / model** (Blender, Maya, ZBrush + Substance 3D / Painter) | Hero interactive props, anything that articulates, anything that ships | You have no art time and only need a volume for layout | Time; you own every decision |

**Studio default:** DCC for anything the user *operates*. Scan or AI for background dress and for *reference* that a DCC artist matches. Do not ship a raw generator mesh as a grab target.

### Path notes

- **Photogrammetry.** Shoot polarized or cross-polarized if you can; keep a chrome/gray ball or a ColorChecker in at least one frame. Scale the reconstruction with a measured stick, not “looks about right.” Expect to retopo; the scan is a high-poly bake source.
- **AI mesh.** Treat the result as a **sculpting reference + silhouette**. Prompt for “hard surface, closed manifold, real-world cm dimensions” and still retopo. Legal: do not ingest competitor products or living-person likenesses. Check generator ToS for commercial use before a client review.
- **DCC.** Model to real cm. Bevels that read at 2K on a monitor often vanish under FFR — slightly larger edge highlights, not more triangles. Build mechanical pivots as empty nodes on the hinge axis.

Rejoin criterion: you have (or will have) a **low-poly render mesh**, a **high-poly bake source** if needed, and a written state list. If any of those is missing, you are still in generation.

## 3. Cleanup (retopo, UV, bake)

Cleanup is where photoreal *look* and realtime *cost* are decided. Do this in DCC, not in the engine.

1. **Scale and orientation** — 1 unit = 1 m; Y-up (or convert on export); origin at a sensible rest pose (floor contact or grip centroid). Apply transforms before export.
2. **Retopo** — Quads on deformation/hinges; triangles acceptable on rigid hero shells. Separate moving parts into nodes (`lid`, `latch`, `body`). Delete interiors the user will never see.
3. **UVs** — Unique UVs for bake targets. Texel density consistent on parts seen together (studio starting point: ~10–20 px/cm on hero-at-arm’s-length). Pack with padding for mipmaps (2–8 px at 1K/2K).
4. **Bake** (high → low) — Normal (OpenGL vs DirectX: pick one and document it; Three.js `MeshStandardMaterial.normalMap` expects OpenGL-style +Y). Ambient occlusion. Optional curvature/thickness for wear. Do **not** bake scene lighting into base color.
5. **PBR maps** — Author as:
   - `baseColor` (sRGB, no baked shadows)
   - `normal` (linear)
   - packed `occlusion + roughness + metalness` (ORM in RGB) or separate roughness/metalness
   - `emissive` only for actual emitters
   - Optional clearcoat / transmission only if the runtime material will use the matching glTF extension **and** the budget allows
6. **Naming** — `propName_part_LOD0`. Collider meshes: `collider_grab`, `collider_latch`, `collider_lid` (see ADR 0004). Never reuse the render mesh name for a collider.

Validate: watertight enough for your physics hull (convex pieces), no inverted normals, no 8K “just in case” textures.

## 4. Realtime packaging

Export **glTF 2.0** as `.glb` (binary). This is the studio interchange ([ADR 0004](adr/0004-asset-interaction-architecture.md)).

| Concern | Studio practice |
| --- | --- |
| Format | glTF 2.0 GLB; metallic-roughness workflow |
| Compression | **meshopt** (`EXT_meshopt_compression`) for runtime decode; Draco (`KHR_draco_mesh_compression`) when download size dominates and load-time decode is acceptable. Do not double-compress blindly — measure. |
| Textures | KTX2 / Basis Universal (`KHR_texture_basisu`): ETC1S for albedo-like, UASTC for normals. Power-of-two. Mipmaps on. |
| Texture size | See [photoreal-realtime](../docs/performance/photoreal-realtime.md). Default hero: 1K–2K albedo, 1K–2K normal, 1K ORM. Set dressing: 512–1K. No 4K on handheld props. |
| LODs | `LOD0` (arm’s length), `LOD1` (~2–3 m), `LOD2` impostor or 512-atlas flake. Switch on camera distance, not magic. |
| Collision | Separate low-poly convex hulls or boxes/capsules as nodes. Export them in the same GLB (no materials, or a debug material stripped at ingest) **or** as extras-referenced primitives. |
| Animation | Hinges as node TRS animation clips (`open`, `close`) or runtime-driven; do not morph a 20k lid if a 200-tri lid node can rotate. |
| Variants | `KHR_materials_variants` for clean/dirty or language labels — not for gameplay state. Gameplay state is behavior metadata. |
| Validate | [glTF Validator](https://github.khronos.org/glTF-Validator/). Fail CI on errors. Warnings need an owner. |

**Load path:** versioned URL under `content/<project>/<revision>/` (immutable). App shows progress; do not stall the XR frame on a giant decode — decode before `requestSession` or behind a loading plaza.

**Engine ingest (Three.js default):** `GLTFLoader` + `MeshoptDecoder` / `DRACOLoader` / `KTX2Loader` as needed. After load, walk nodes, attach components from extras/sidecar, **hide collider meshes**, and register colliders with the interaction system — not `scene.traverse` raycasts against every `Mesh`.

## 5. Interaction layer

Behavior is data plus a small runtime, not shader tricks or one-off `click` handlers on the visual.

### Component set (ECS-ish)

Defined in [ADR 0004](adr/0004-asset-interaction-architecture.md). Minimum on an interactive prop:

| Component | Responsibility |
| --- | --- |
| `Visual` | Render meshes / materials / clips. Never used as a physics or pick target. |
| `Collider` | Hulls for ray, near-grab, and (optional) physics. Layers: `grab`, `use`, `ui`, `world`. |
| `Hoverable` | Idle / hover / pressed / disabled / grabbed affordances. |
| `Grabbable` | Attach to `gripSpace` when near; optional ray grab; throw impulse on release. |
| `Activity` | Named state machine; inputs are *intents* (`use`, `grab`, `release`), not raw buttons. |
| `Physics` | Optional rigid body on a **hull**, not the render mesh. |
| `Feedback` | Audio + haptic ids per transition (pair with visuals; never audio-only). |

### Grab and throw

- **Near grab (preferred):** when `gripSpace` (or a palm joint) is inside the grab collider, `squeeze` / pinch attaches the **root** (or the declared attach node) to the grip. Use `Object3D.attach` (Three.js) so world pose is preserved.
- **Ray grab:** only if the brief says so (tools on a shelf). Keep a hold offset; do not slam the object onto the ray origin.
- **Throw:** on `squeezeend`, sample recent grip translation (4–8 XR frames), apply velocity to the physics hull or a tiny kinematic integrator. Clamp speed. **Never** add the impulse to the camera/rig.
- **Two-handed:** explicit in the brief (stable hold vs scale/rotate). Default is one owner at a time; second squeeze is ignored or steals with a haptic nack.

### Hover affordances

Every `Hoverable` implements the [spatial UI](../docs/design/spatial-ui.md) states: idle / hover / pressed / disabled, plus `grabbed`. Photoreal props still need a **readable** hover: rim / slight emissive / latch micro-motion — not a flat unlit overlay that breaks IBL. See [interactive-objects](../docs/design/interactive-objects.md).

### Multi-step activities (state machine)

```
closed --use(latch)--> unlatched --use(lid|latch)--> open
open   --use(lid)----> closed
```

Rules:

- States are named strings (or enums) stored on the entity. Illegal transitions no-op with a short haptic nack.
- Each transition may play a clip, swap a collider (lid volume moves), spawn/despawn a child grabbable (tool in the box), and fire `Feedback`.
- Persist enough state to survive drop and session end (`open` stays `open` unless the brief resets).
- Do not encode sequence in animation time alone — animation is a view of the state.

### Physics hooks

The runtime exposes intents, not engine-specific types:

- `onGrab(entity, pose)` — disable or kinematic-lock the body
- `onRelease(entity, pose, velocity)` — wake body
- `onContact(entity, other, impulse)` — for pour triggers, snap sockets, tool-on-target

Studio default physics (when you need it): a lightweight WASM engine (e.g. Rapier) or engine built-in, **one** simulation step per XR frame, colliders from hulls. The starter examples may use kinematic integration only; that is a demo constraint, not the product architecture.

### Audio and haptics

- Spatialize one-shots on the prop (`PannerNode` / engine positional audio).
- Pulse `gamepad.hapticActuators` (or `vibrationActuator` when that is what the source exposes) on hover-enter (very light), grab, and committed state changes. Degrade if missing ([audio-haptics](../docs/design/audio-haptics-presence.md)).
- Critical confirmations are visual + audio + haptic. Audio-only state is an a11y fail.

## 6. WebXR input binding

Bind **intents**, not vendor button indices. Raw API surface is [`docs/fundamentals/input-sources.md`](../docs/fundamentals/input-sources.md) and [ADR 0003](adr/0003-interaction.md).

| Intent | Controllers | Hands (optional feature) |
| --- | --- | --- |
| Point / hover | `frame.getPose(inputSource.targetRaySpace, refSpace)` + ray vs use/grab colliders | Same target ray when the UA provides one; else finger-direction from index tip |
| `use` | `selectstart` / `select` / `selectend` on `XRSession` | Pinch (thumb-tip ↔ index-finger-tip) mapped to select; Three.js does **not** invent a pinch event — you measure joints on `XRHand` |
| `grab` | `squeezestart` / `squeeze` / `squeezeend` when the profile has squeeze; near-grab if grip is in hull | Pinch-and-hold inside the grab hull, attach to `wrist` (or palm joint). Hands often have no squeeze. |
| Axes | `inputSource.gamepad.axes` (profile-dependent) for optional tool analog | Ignore unless you have a measured joint gesture |

Implementation notes (real APIs only):

- Discover sources via `session.inputSources` and `inputsourceschange`.
- `gripSpace` may be `null` — then near-grab is unavailable; fall back to ray or disable grab.
- Request `hand-tracking` only as `optionalFeatures` on `requestSession`. If `inputSource.hand` is absent, the controller path must still complete the activity.
- `profiles[]` picks controller meshes (`XRControllerModelFactory` in Three.js). Do not hard-code a Quest mesh as the only model.
- Three.js mapping used in examples: `renderer.xr.getController(i)` (target ray + select/squeeze events), `getControllerGrip(i)` (grip attach), `getHand(i)` + `XRHandModelFactory` (joints). Those helpers wrap the WebXR sources; debug with the MDN model when something misses.

### Complex activity examples

These are patterns, not extra APIs. Each uses the same components.

**Assemble (socket sequence)**  
Parts are `Grabbable`. Sockets are trigger colliders with an align cone (position + forward). `use` or release-in-tolerance snaps and transitions `loose` → `seated` → `locked`. Sequence constraints live on the parent `Activity` (`step2` requires `step1 === locked`). Ghost mesh = `Visual` only, no collider until the step is legal.

**Pour**  
Vessel `Activity` holds `fillLevel`. While grabbed, sample grip quaternion; if tilt exceeds a threshold **and** a receptacle trigger overlaps the pour lip collider, decrease source / increase dest per frame. Splash is VFX parented to the lip, not a physics fluid. Spill-on-floor is a state + decal budget, not a particle flood.

**Open, multi-stage**  
Independent colliders: latch (`use`), lid (`use` after unlatch), optional inner drawer. Grab hull is the body so picking up the box does not fire `use`. Clips play on the lid node. Inner contents get `Grabbable` enabled only in `open` (disable collider when closed so rays do not hit hidden tools).

**Tool use**  
Held tool has a **tip collider** (use layer) and a grab hull. Target has a receiver trigger + align. While grabbed and aligned, hold `use` to accumulate `progress`; complete → target `Activity` transition. Misalign nacks. Do not run the progress check on the decorative bit of the mesh.

Runnable slice of multi-stage open + grab: [`examples/interactive-prop/`](../examples/interactive-prop/).

## 7. QA gates

An interactive photoreal prop is not done when the GLB looks good in a DCC viewport. Gate on [`quality-bar.md`](quality-bar.md) **plus** the interactive-asset section there.

Copy this onto the content revision:

### Brief and scale

- [ ] BRIEF.md lists photoreal refs + named states + grab vs use parts
- [ ] 1 unit = 1 m verified next to a 1.7 m reference and a seated reach (~0.4–0.6 m forward)
- [ ] Mass / throw clamp documented if physics is enabled

### Packaging

- [ ] glTF Validator clean (or warnings owned)
- [ ] LOD and texture class match [photoreal-realtime](../docs/performance/photoreal-realtime.md) for the lowest-tier device
- [ ] Collider nodes present and hidden at runtime; hero mesh is not the pick target
- [ ] extras/sidecar matches [ADR 0004](adr/0004-asset-interaction-architecture.md); ingest test in the example or app

### Interaction

- [ ] Hover / pressed / disabled / grabbed all readable under FFR
- [ ] `select` drives `use`; `squeeze` drives grab on controllers
- [ ] Core activity completable **without** hand-tracking
- [ ] Hands, if advertised, pinch-to-use and pinch-hold-to-grab; no-hands fallback still works
- [ ] Illegal transitions nack; drop mid-sequence does not soft-lock
- [ ] Tracking loss (`null` poses) releases grab safely

### Comfort, a11y, ship

- [ ] No camera impulse from throw or collision
- [ ] Seated: all `use` targets reachable or have a ray-use path
- [ ] State change is visual + (audio and/or haptic); not audio-only
- [ ] Hero scene with this prop holds target Hz ([quality-bar](quality-bar.md) Performance)
- [ ] Device/browser matrix still accurate ([shipping](../docs/shipping/))

Fail the revision if any applicable box is unchecked.

## Related

| Doc | Role |
| --- | --- |
| [additive-object-iteration.md](additive-object-iteration.md) | UPGRADE vs NEW; L0–L5 stack; revision retention |
| [ADR 0005](adr/0005-additive-object-evolution.md) | Stable ids + layered manifests |
| [content-pipeline.md](content-pipeline.md) | Short export / optimize / verify checklist |
| [quality-bar.md](quality-bar.md) | Definition of done |
| [ADR 0003](adr/0003-interaction.md) | Rays, select, squeeze, hybrid grab |
| [ADR 0004](adr/0004-asset-interaction-architecture.md) | glTF + metadata + components |
| [interactive-objects.md](../docs/design/interactive-objects.md) | Affordance and activity patterns |
| [photoreal-realtime.md](../docs/performance/photoreal-realtime.md) | Frame-budget look |
| [examples/interactive-prop](../examples/interactive-prop/) | Hover + grab + multi-state box |
