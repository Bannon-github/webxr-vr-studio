# Horizon Store gate (agent entry)

This folder is the **store-gate** layer agents plug into when asked to build a VR app that should meet [Meta Horizon Store](https://developers.meta.com/horizon/resources/publish-quest-req/) review — not a guarantee of approval.

**This repo remains a WebXR playbook** (Quest 3 + Quest Browser, Vite + Three.js). Store delivery is a *separate* product decision. Read [webxr-vs-native.md](webxr-vs-native.md) before scaffolding anything.

**Confidence:** a filled brief plus a green checklist is a *studio gate*, not Meta’s review. Do not claim 100% store confidence. Re-fetch official pages on the day you submit.

## Agent workflow (do not skip)

1. Run the ordered interrogation: [`studio/app-interrogation.md`](../../../studio/app-interrogation.md). One question stream. Close every ambiguity.
2. Write the brief: copy [`studio/briefs/_template/`](../../../studio/briefs/_template/) → `studio/briefs/<app-id>/`. Fill `app-brief.md` so it validates against [`app-brief.schema.json`](../../../studio/briefs/_template/app-brief.schema.json).
3. Run this folder’s checklists against that brief:
   - [requirements-pass.md](requirements-pass.md) — what Meta typically requires
   - [disqualification-avoid.md](disqualification-avoid.md) — known rejection / DQ patterns
4. Record the gate on the brief (`storeGate.status`). **No app scaffold until the brief exists and the gate passes** ([ADR 0006](../../../studio/adr/0006-store-gate-before-build.md)).
5. Only then generate code, picking the path locked in the brief (this repo’s WebXR examples **or** a native Unity/Unreal/Spatial SDK project *outside* this knowledge base).

Browser-only WebXR (no Store listing) still runs interrogation + brief. The Store VRC columns may be `n/a`, but platform, comfort, Quest 3, and privacy questions are not optional.

## Contents

| Doc | Use |
| --- | --- |
| [requirements-pass.md](requirements-pass.md) | Agent-runnable approval checklist (age, privacy, comfort, perf, input, permissions, listing assets) |
| [disqualification-avoid.md](disqualification-avoid.md) | Design against common review failures |
| [webxr-vs-native.md](webxr-vs-native.md) | Early fork: hosted WebXR / WebXR PWA / native Store |

Living design quality bars for *this* studio (comfort, locomotion, Quest 3 90 Hz) stay in [`docs/design/`](../../design/) and [`quest-3-target.md`](../quest-3-target.md). Update those when the studio bar moves; update *this* folder when Meta’s published VRCs / policies move.

## Canonical Meta pages (re-fetch; do not snapshot numbers as eternal)

| Topic | Official page |
| --- | --- |
| Virtual Reality Checks (VRC) | [publish-quest-req](https://developers.meta.com/horizon/resources/publish-quest-req/) |
| Submit / review | [publish-submit](https://developers.meta.com/horizon/resources/publish-submit/) |
| Store listing assets | [asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/) |
| App policies (payments, ads, comfort rating, IARC) | [app-policies](https://developers.meta.com/horizon/policy/app-policies/) |
| Content guidelines | [content-guidelines](https://developers.meta.com/horizon/policy/content-guidelines/) |
| Age group self-certification | [age-groups](https://developers.meta.com/horizon/resources/age-groups/) |
| Data Use Checkup | [publish-data-use](https://developers.meta.com/horizon/resources/publish-data-use/) |
| Developer Data Use Policy | [data-use](https://developers.meta.com/horizon/policy/data-use/) |
| Common VRC failures | [publish-common-vrc-failures](https://developers.meta.com/horizon/resources/publish-common-vrc-failures/) |
| WebXR in Quest Browser | [documentation/web](https://developers.meta.com/horizon/documentation/web/) |
| PWA → Store | [pwa-overview](https://developers.meta.com/horizon/documentation/web/pwa-overview/) |
| WebXR PWA IAP | [ps-iap](https://developers.meta.com/horizon/documentation/web/ps-iap/) |
| Unity publish prep | [unity-prepare-for-publish](https://developers.meta.com/horizon/documentation/unity/unity-prepare-for-publish/) |

**TODO (verify-on-fetch):** Meta’s test-plan spreadsheet is explicitly *not* source of truth ([VRC page note](https://developers.meta.com/horizon/resources/publish-quest-req/)). Always prefer the live VRC table over cached copies in this repo.

## Hardware

Primary target remains **Meta Quest 3**. Quest 3S is in-family. Do not author to Quest 2 or 207/240 Hz extended modes as the ship gate ([quest-3-target](../quest-3-target.md)).
