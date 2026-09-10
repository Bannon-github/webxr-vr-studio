# Interactive photoreal props

Design patterns for objects that look photographed but still teach the user what to do with them in WebXR.

Pair with the production path in [`studio/asset-to-interaction-workflow.md`](../../studio/asset-to-interaction-workflow.md) and the runtime split in [ADR 0004](../../studio/adr/0004-asset-interaction-architecture.md). Input contract: [ADR 0003](../../studio/adr/0003-interaction.md). Spatial UI states: [spatial-ui.md](spatial-ui.md).

## The readability problem

Photoreal materials hide affordances. A PBR latch that is “just metal” does not tell a first-time user it is the first step. XR also blurs the thing you cared about: FFR, 72/90 Hz budgets, and a 2 cm target at 70 cm.

Design the **read** first, then the **look**.

1. Silhouette of the operable part is distinct at arm’s length.
2. Motion grammar is consistent across the product (latches flip the same way; sockets always ghost in cyan-warm, not a new language per prop).
3. State is visible in geometry or lighting, not only in a HUD.

## Three objects, one prop

| Layer | What the user should perceive | What the runtime uses |
| --- | --- | --- |
| Visual | Photoreal surface, wear, correct scale | `Visual` meshes, IBL, clips |
| Collider | Where their hand/ray “hits” | Hulls larger than the pretty edge, simpler than the render mesh |
| Behavior | What happens next | `Activity` states, grab ownership |

Never let the visual mesh define the hit. A scanned handle with holes will drop rays; a hero bevel will feel smaller than the hand. Inflate use-targets toward the [spatial UI](spatial-ui.md) minimum angular size; keep the render mesh honest to real-world mm.

## Affordance states

Implement all five on anything `Hoverable`. Photoreal is not an excuse to skip two of them.

| State | Visual (keep PBR) | Motion | Audio / haptic |
| --- | --- | --- | --- |
| Idle | Authored look | None or tiny idle (dust, LED) | None |
| Hover | Rim, sheen, or local emissive *on the part*, not the whole hero | Optional 1–2° latch lift | Light pulse + soft tick |
| Pressed / using | Deeper contact (latch depressed) | Follows the button/clip | Click + stronger pulse |
| Disabled | Desaturate or hide the ghost; do not rely on red-only | No travel | Optional nack |
| Grabbed | Hands/controller occlusion OK; slight settle into grip | Follows `gripSpace` | Grab thump |

Prefer **local** highlight (the latch) over a whole-object unlit tint that kills the material. If you must outline, use a thin mesh or inverted-hull at a scale that survives FFR — 1 px screenspace outlines vanish.

Disabled means *illegal in this state* (lid `use` while `closed`), not “we did not hook it up.”

## Grab, hold, throw

- **Near-field first.** If the user can reach it, they should pick it up from the body, not shoot a laser at a 4 cm latch.
- **Stable attach.** Offset is authored (grip helper empty in the GLB). Do not attach at the ray hit point on a scanned surface — the object will float wrong in the hand.
- **One owner.** A second controller nacks unless the brief is two-handed.
- **Throw is a consequence, not a joke.** Clamp speed; heavy objects thud and stay; never shove the camera. See comfort: [comfort.md](comfort.md).
- **Put-down.** A horizontal “table” snap or a sleep threshold beats bouncing across the guardian for five seconds.

Hands: pinch-hold to grab is allowed as enhancement. The same prop must be completable with squeeze + select on controllers.

## Multi-step activities

Name states in the brief and on a diegetic indicator if the sequence is longer than two steps.

**Patterns that read in photoreal scenes**

- **Reveal the next control.** Unlatching exposes a darker lid gap or a second highlight. Do not require a tutorial tooltip as the only cue.
- **Ghost the legal action.** A low-opacity lid arc or socket shell (`Visual` only) appears when the state makes that action legal.
- **Commit, then animate.** State changes on the intent; the clip is the view. If the user drops mid-clip, finish to the committed state or rewind to the previous *named* state — do not leave a half-open lid that is not a state.
- **Soft-lock prevention.** Every state has a way out (including “reset on table”). Dropping a part does not freeze the machine.

Author transitions as a table in the content revision (from, intent, collider, to, feedback). Engineers implement that table, not a new DSL per prop.

## Complex loops (design notes)

**Assemble** — Show the next socket only (or brighter). Seated users need sockets in the front 120°. Snap should feel magnetic in the last few cm, not a teleport from 40 cm (that reads as a bug). Locked parts lose their grab hull or become the new parent.

**Pour** — The lip must be readable in silhouette. Fill level is a mesh blend, shader clip, or decal — pick one and keep it stable under IBL. Warn before empty; do not require sound to know it is dry.

**Open multi-stage** — Latch, then lid, then contents. Contents are not hoverable through the closed lid (disable inner colliders). The grab hull is the body so “pick up” and “open” cannot be the same target.

**Tool use** — Tip vs handle must read in 10 cm of motion. Alignment: a narrow cone and a progress ring *on the target*, not a head-locked bar. Releasing `use` pauses or decays progress; document which.

Runnable illustration: [`examples/interactive-prop`](../../examples/interactive-prop/) (latch → lid, grab the box, tool enabled only when open).

## Anti-patterns

- Raycasting the high-poly visual (flicker, missed hits, GPU cost).
- Hover = replace `MeshStandardMaterial` with unlit magenta.
- State stored only in an animation `time` you cannot query.
- Hands-only pinch with no `select`/`squeeze` path.
- 4K texture as a substitute for a readable latch silhouette.
- Physics on the render mesh (throw explodes, fingers snag).
- Camera-attached labels as the only state display (strain + FFR).

## Checklist (design sign-off)

- [ ] Idle vs hover vs pressed vs disabled vs grabbed photographed in headset, FFR on
- [ ] Operable part identifiable in a mute test (no audio)
- [ ] Seated reach or ray-use for every required step
- [ ] Grab and use targets are different colliders when the brief has both
- [ ] Named states; no illegal transition leaves a nameless pose
