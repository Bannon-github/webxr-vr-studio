# ADR 0004 — Asset and interaction architecture

- Status: Accepted
- Date: 2026-09-09

## Context

Photoreal props arrive as dense meshes and PBR maps. Interactive WebXR props also need pick targets, grab attach, multi-step state, optional physics, and audio/haptic feedback. If those concerns live on the render mesh (raycast the hero, `if (name === "Cube")` in the frame loop, animation time as state), we get missed hits, frame spikes, and untestable activities.

We need a default that:

- Uses **real interchange** (glTF 2.0), not an engine-only binary
- Separates **visual vs collider vs behavior**
- Fits [ADR 0001](0001-framework.md) (Three.js default) and [ADR 0003](0003-interaction.md) (ray + hybrid near-grab, select/squeeze)
- Stays honest: there is **no** Khronos `KHR_interaction` for gameplay. We will not invent a fake extension name that looks official.

## Decision

1. **Interchange:** Author and ship **glTF 2.0** `.glb` with metallic-roughness PBR. Optional real extensions only: `KHR_draco_mesh_compression`, `EXT_meshopt_compression`, `KHR_texture_basisu`, `KHR_materials_variants`, `KHR_materials_*` when budgeted. Animation clips for authored motion.

2. **Node layout:** One root per prop. Child nodes for moving parts (`lid`, `latch`). **Collider nodes** are siblings (or children) named `collider_<layer>` (`collider_grab`, `collider_latch`, `collider_lid`, `collider_tip`). Collider meshes are low-poly convex/box/capsule stand-ins. The runtime hides them and never draws them in production.

3. **Behavior metadata (two layers, same schema):**
   - **Sidecar (source of truth for gameplay):** `prop.behavior.json` next to the GLB in the content revision. Versioned with the asset.
   - **glTF `extras.studio` (authoring hint / fallback):** the same JSON object (or a pointer: `{ "behaviorUri": "prop.behavior.json" }`) on the root node. Used so DCC exports are self-describing. If both exist, **sidecar wins**.

   `extras` is a glTF-legal field. The `studio` key is **our convention**, not a Khronos extension. Do not prefix it `KHR_`.

4. **Schema (minimum):** ECS-ish components on the entity (the glTF root or a named node). Unknown components are ignored, not fatal.

```json
{
  "version": 1,
  "entity": "toolbox",
  "components": {
    "visual": { "lodGroup": "toolbox_lod" },
    "colliders": [
      { "node": "collider_grab", "layer": "grab", "shape": "box" },
      { "node": "collider_latch", "layer": "use", "shape": "box" },
      { "node": "collider_lid", "layer": "use", "shape": "box" }
    ],
    "hoverable": { "parts": ["latch", "lid", "body"] },
    "grabbable": { "attachNode": "toolbox", "nearMeters": 0.25, "throwOnRelease": true },
    "activity": {
      "id": "open-box",
      "initial": "closed",
      "states": ["closed", "unlatched", "open"],
      "transitions": [
        { "from": "closed", "intent": "use", "collider": "collider_latch", "to": "unlatched" },
        { "from": "unlatched", "intent": "use", "collider": "collider_lid", "to": "open" },
        { "from": "unlatched", "intent": "use", "collider": "collider_latch", "to": "open" },
        { "from": "open", "intent": "use", "collider": "collider_lid", "to": "closed" }
      ]
    },
    "physics": { "enabled": false, "collider": "collider_grab", "mass": 1.2 },
    "feedback": {
      "hoverEnter": { "haptic": 0.15, "ms": 20 },
      "grab": { "haptic": 0.4, "ms": 40, "audio": "grab" },
      "nack": { "haptic": 0.25, "ms": 30 }
    }
  }
}
```

5. **Runtime:** On ingest, spawn an entity and attach components. The frame loop dispatches **intents** (`hover`, `use`, `grab`, `release`) from WebXR `select` / `squeeze` / poses (ADR 0003). The activity machine is the only place named states change. Three.js mapping: components live on `Object3D.userData.studio` after load; pick lists are collider meshes only.

6. **Physics:** Optional component. Simulate hulls, not visuals. Demo code may use a kinematic integrator; products may use a WASM engine. The component interface stays `onGrab` / `onRelease(velocity)` / `onContact` so examples and products share the metadata.

7. **Hands:** No separate behavior file. The input adapter maps pinch to `use` and pinch-hold-in-hull to `grab`. If `hand-tracking` is missing, the same metadata still runs.

## Consequences

- Content revisions include GLB + `BRIEF.md` + `*.behavior.json` (or complete `extras.studio`).
- QA rejects hero-mesh picking and animation-time-as-state ([quality-bar](../quality-bar.md) interactive assets; [workflow QA](../asset-to-interaction-workflow.md)).
- Engine swaps (ADR 0001) keep the sidecar; only the ingest adapter changes.
- Authors must not mint `KHR_studio_*` extensions. If Khronos later standardizes interaction, we supersede this ADR.
- [`examples/interactive-prop`](../../examples/interactive-prop/) is the executable contract: procedural stand-in meshes, same component split, same intents.

## Related

- [ADR 0003](0003-interaction.md) — how intents are produced
- [asset-to-interaction-workflow.md](../asset-to-interaction-workflow.md) — production path
- [interactive-objects.md](../../docs/design/interactive-objects.md) — feel and affordances
