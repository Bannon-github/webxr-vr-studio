# crate-toolbox

## 0.5.0 — 2026-09-09

- **Delta (additive, shipping/perf gate):** Same L0–L5 activity. `perf.notes` now points at [quest-3-on-device-qa](../../../docs/shipping/quest-3-on-device-qa.md). Example **`P`** overlay captures supported/requested Hz, FFR, and approximate rAF Δ (off = ~zero cost). **No headset numbers added** — the results table stays blank until a Quest 3 + Quest Browser run.
- **Layers:** unchanged (L0–L5). Not a new layer claim.
- **Quest 3:** Authoring caps unchanged. Frame time / FFR on headset still **TODO**.
- **Revision:** `revisions/v0.5.0/`

## 0.4.0 — 2026-09-09

- **Delta (additive, L5):** Re-latch cancel (`unlatched` + latch → `closed`). Tool remains unpickable while closed. After `open`, grab the screwdriver (`collider_tool` wins over the body grab hull); use `collider_fastener` (4 turns, plaque `DRIVE n/4` → `SEATED`). Release near the slot (or `T`) returns the tool. Desktop `E` extracts. Declared `feedback` keys pulse `gamepad.hapticActuators` when present. LOD0–2 and L4 hull names unchanged; fastener is +12 tris / +1 draw.
- **Layers:** L5 complete. `layerTarget` met.
- **Quest 3:** Still ≪750k tris / ≪100 draws. Frame time / FFR on headset still **TODO**.
- **Revision:** `revisions/v0.4.0/`

## 0.3.0 — 2026-09-09

- **Delta (additive, L3):** Procedural LOD1 (96 tris / 8 draws) and LOD2 (24 / 2) sit beside unchanged LOD0 (240 / 14). Distance switch 2.4 m / 4.5 m with hysteresis; `1`/`2`/`3` force a level, `0` auto. Same part names and L4 hulls (`collider_grab` / latch / lid / tool); activity still `closed` → `unlatched` → `open`.
- **Layers:** L3 now complete (real cheaper visuals + one-level-at-a-time draw). L5 still not claimed.
- **Quest 3:** Authoring stays under studio caps (≪750k tris, ≪100 draws, no 4K maps). Frame time / FFR on headset still **TODO** (not measured).
- **Revision:** `revisions/v0.3.0/` (NOTES + manifest; no GLB)

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
