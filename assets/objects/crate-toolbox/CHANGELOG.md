# crate-toolbox

## 0.2.1 — 2026-09-09

- **Delta (additive):** Manifest `targetDevice: quest3` + `perf` envelope (90 Hz / 72 fallback, ~1.2k LOD0 tris, ≤1024², ~14 draws, box colliders). No mesh change.
- **Layers:** unchanged (L3 still pending a GLB).
- **Revision:** current files (metadata only)

## 0.2.0 — 2026-09-09

- **Delta (additive):** Hollow L1/L2 body so L4 contents are visible; use-colliders win over the grab hull (8 cm near-hit bias); grab box shrunk to the body. Same `objectId`, same states, same sidecar contract.
- **Layers:** L0–L2, L4 still; L3 unset (no LOD set / no GLB). L5 not claimed (kinematic throw only).
- **Revision:** `revisions/v0.2.0/` (procedural — NOTES only; no GLB)

## 0.1.0 — 2026-09-09

- **Delta:** L0–L2 stand-in + L4 latch/lid activity (`closed` / `unlatched` / `open`). Solid body mesh hid the nested tool; grab hull swallowed lid hits.
- **Layers:** L0, L1, L2, L4
- **Revision:** `revisions/v0.1.0/`
