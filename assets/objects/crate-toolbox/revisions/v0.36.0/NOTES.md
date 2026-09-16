# crate-toolbox v0.36.0

L3 packaging/perf UPGRADE on the same `objectId`. No GLB. Not a new layer.

- After v0.35 made every procedural LOD color-only unlit MeshBasic, **packaged GLB ingest wires conventional LOD groups** so inactive levels do not draw. `ingestPackagedRoot` discovers `lod0` / `lod1` / `lod2` (case-insensitive; optional `_` / `-` before the digit) or `userData.lodLevel` 0/1/2 — the same names procedural `lodGroup()` and [ktx2-quest3-packaging](../../../../docs/performance/ktx2-quest3-packaging.md) already use. It populates `userData.lod` with the procedural shape (`current`, `mode`, `distances` 2.4 / 4.5 + hysteresis 0.2, `groups`, `stats`) via shared `attachToolboxLod`, then `setToolboxLod(..., 0)`.
- `setToolboxLod` / `updateToolboxLod` / keys `1` / `2` / `3` hide inactive packaged LOD meshes with visibility only (no per-switch material swap, no frame-loop allocation). Colliders stay out of LOD groups. The fastener (`fastener` / `fastenerMesh`) is not an LOD mesh and stays visible.
- **If no LOD-named groups exist**, fail soft: do not invent fake LODs; the single authored visual set stays visible. Author `lod0` / `lod1` / `lod2` (or tag `userData.lodLevel`) and keep `collider_*` / fastener **outside** those groups. Do not parent colliders or the fastener under an LOD node.
- Procedural path is unchanged: color-only unlit MeshBasic on LOD0 / LOD1 / LOD2; unique canvases 0; draws 14 / 8 / 2 + fastener 1. The loader still does **not** rewrite materials at ingest.
- Geometry, collider names, and L4/L5 activity are the v0.4.0–v0.35.0 set. Session present-path chain (v0.15–v0.22) and v0.8 allocation scrub stay as they were. The v0.36 `behavior.json` sidecar is frozen next to this manifest (`source.behavior`) so the revision resolves without reading a later current sidecar.
- **KTX2 / Basis** remains the packaging step when a DCC GLB lands. No GLB in this revision.
- Quest 3 frame time / FFR still **unmeasured**. Do not treat this pulse as a 90 Hz pass. Inactive packaged LOD meshes not drawing (when the GLB actually contains named LOD groups) is the intended delta.
