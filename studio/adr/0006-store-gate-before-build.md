# ADR 0006 — Store-gate before app scaffold

- Status: Accepted
- Date: 2026-09-11

## Context

Agents asked to “build a Quest / Horizon Store VR app” will otherwise jump to a Vite+Three.js example or a Unity template with locomotion, IAP, age, and listing undecided. Those ambiguities are how titles miss [Meta Horizon Store VRCs](https://developers.meta.com/horizon/resources/publish-quest-req/) *and* this studio’s Quest 3 WebXR bar.

This repo is a **WebXR playbook** with optional Store packaging (PWA). Native Unity is a different path ([webxr-vs-native](../../docs/shipping/horizon-store/webxr-vs-native.md)). A scaffold is expensive to unwind; a brief is not.

Existing ADRs already lock engine (0001), locomotion (0002), interaction (0003), and object evolution (0004–0005). They do not say **when** an *app* may be generated.

## Decision

1. **No app scaffold until the brief exists and the store-gate passes.** An “app scaffold” includes new `examples/<app>/` trees, production app folders, Bubblewrap/Android projects, and native engine projects initiated on behalf of a title. Object-catalog work under `assets/objects/` and edits to existing examples are not app scaffolds.

2. **Brief.** Copy [`studio/briefs/_template/`](../briefs/_template/) to `studio/briefs/<appId>/`. Fill from the ordered stream in [`studio/app-interrogation.md`](../app-interrogation.md). YAML/JSON must satisfy [`app-brief.schema.json`](../briefs/_template/app-brief.schema.json). `ambiguities` must be `[]`. `interrogation.completedThrough` must be `20`.

3. **Store-gate.** Apply [`docs/shipping/horizon-store/requirements-pass.md`](../../docs/shipping/horizon-store/requirements-pass.md) and [`disqualification-avoid.md`](../../docs/shipping/horizon-store/disqualification-avoid.md) against that brief. Re-fetch official Meta pages the day of the gate; do not treat in-repo tables as live policy. Record `storeGate` on the brief.

4. **Pass criteria.**
   - `storeGate.result: pass` — Horizon Store (or committed later PWA) is in scope and required rows are closed or explicitly `TODO verify-on-fetch` with an owner, none of which are blockers.
   - `storeGate.result: n/a-browser-only` — `platform.path` is `webxr-hosted`, `distribution.horizonStore` is false, `laterPwa` is false. Comfort, Quest 3, privacy-if-collecting, and path lock still required.
   - `fail` / `not-run` / non-empty `ambiguities` → **generate nothing**.

5. **Path lock is irreversible without a new brief revision.** `platform.path` chooses WebXR hosted, WebXR PWA, or native. Native paths get **no** Three.js app generated in this repo.

6. **Honesty.** A passed gate is a studio control, not Meta approval. Agents must not claim store confidence percentages.

## Consequences

- Playbook cadence gains an interrogation + store-gate ritual before title kickoff ([playbook](../playbook.md)).
- Existing Quest 3 WebXR docs remain the implementation bar for paths A/B; Store VRCs are additional for B/C.
- Quality-bar “done” for a *new title* includes a linked brief. Feature work on `crate-toolbox` / current examples does not.
- Supersede this ADR if Meta ships a single mandatory submission format that collapses WebXR PWA vs native, or if the studio stops taking Store-bound work.
