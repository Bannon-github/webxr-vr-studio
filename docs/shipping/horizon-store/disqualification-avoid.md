# Disqualification avoidance — design against known rejects

Patterns that repeatedly fail [VRC](https://developers.meta.com/horizon/resources/publish-quest-req/) / policy review, and how to design so they cannot happen by accident. Pair with [requirements-pass.md](requirements-pass.md).

Meta itself: “Developers fail certain VRCs much more often than others” ([VRC intro](https://developers.meta.com/horizon/resources/publish-quest-req/), [common VRC failures](https://developers.meta.com/horizon/resources/publish-common-vrc-failures/)). Saturated genres may stop at the **first** guideline hit ([publish-submit](https://developers.meta.com/horizon/resources/publish-submit/)).

This is **not** an exhaustive reject taxonomy. **TODO (verify-on-fetch):** re-read common-failures + Content Guidelines on the submit week.

---

## 1. Store art that looks like marketing instead of a product

**Fails:** [Asset.2](https://developers.meta.com/horizon/resources/vrc-quest-asset-2/), [Asset.5](https://developers.meta.com/horizon/resources/vrc-quest-asset-5/), [Asset.1](https://developers.meta.com/horizon/resources/vrc-quest-asset-1/), safe-area / title rules in [asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/).

| Do not | Design instead |
| --- | --- |
| Taglines, “#1 VR GAME”, sale banners, quotes, OS badges on covers | Title + one key visual, contrast, **safe area**. No other text larger than the title |
| Opaque / photographed logo on gray | Transparent **32-bit** logo if you upload a logo |
| Screenshots with HUD watermarks, Steam/PS/Xbox marks, mock store UI | Five **distinct in-headset** shots; mixed-reality / 3rd POV at most 1–2 |
| Other-platform HMD in trailer or hero | Quest 3 (or in-family Quest) only ([Functional.6](https://developers.meta.com/horizon/resources/vrc-quest-functional-6/), [Asset.6](https://developers.meta.com/horizon/resources/vrc-quest-asset-6/)) |
| Trailer > 2 minutes or all logo stings | 30 s–2 min, gameplay-representative ([Asset.7](https://developers.meta.com/horizon/resources/vrc-quest-asset-7/), asset-guidelines trailer section) |
| Icon with transparency or rounded baked corners | 512² opaque, square corners (verify size on live asset-guidelines) |

Commission listing art **after** the title string is frozen. Changing the Dashboard name without re-exporting covers fails “exact title match.”

---

## 2. Privacy policy theater

**Fails:** [Privacy.1](https://developers.meta.com/horizon/resources/vrc-quest-privacy-1/) (Meta: commonly failed), [Privacy.4](https://developers.meta.com/horizon/resources/vrc-quest-privacy-4/) (commonly failed), [Privacy.2](https://developers.meta.com/horizon/resources/vrc-quest-privacy-2/)/[.3](https://developers.meta.com/horizon/resources/vrc-quest-privacy-3/).

| Do not | Design instead |
| --- | --- |
| Notion/Google Doc that 404s, requires login, or auto-downloads a PDF | Public HTTPS page the team owns; Meta re-checks after ship |
| Policy hosted on another VR store | Own site / accepted hosts listed on Privacy.1 — **TODO verify-on-fetch** current host list |
| “We may collect data” with no inventory | Enumerate mic, camera, hands, accounts, analytics, crash |
| Deletion = “contact us” with a fee or EU-only | Free deletion path for **all** users, or an honest “no store” statement |
| DUC skipped while using IAP / friends / age API | Complete [DUC](https://developers.meta.com/horizon/resources/publish-data-use/) before those APIs leave test users |

If the app truly stores nothing, **say that** and do not add analytics SDKs later without revising the policy (Content.2 / metadata match).

---

## 3. Comfort lie (defaults vs settings)

**Fails:** reviewer/user comfort rating vs [App policies §5.1](https://developers.meta.com/horizon/policy/app-policies/); sickness as a P0 in this studio ([playbook](../../../studio/playbook.md)).

Store rating judges the **default** experience. Smooth locomotion in the first session is **Intense** (or at least Moderate), even if teleport exists in a submenu.

| Do not | Design instead |
| --- | --- |
| Ship continuous loco + smooth turn as default, label Comfortable | Default = studio **Tier A** (teleport + snap). Opt-in Tier C ([ADR 0002](../../../studio/adr/0002-locomotion.md)) |
| Artificial pitch, bobbing camera, horizon tilt | Horizon locked; no forced pitch ([comfort](../../design/comfort.md)) |
| Head-locked giant HUD | World-locked / body-locked panels ([Functional.10](https://developers.meta.com/horizon/resources/vrc-quest-functional-10/), [spatial-ui](../../design/spatial-ui.md)) |
| No recenter in a seated/local space | In-app reset forward ([Functional.9](https://developers.meta.com/horizon/resources/vrc-quest-functional-9/)) |

Passing VRC Performance.1 does not make an Intense loco Comfortable.

---

## 4. “It runs on my PC” performance

**Fails:** [Performance.1](https://developers.meta.com/horizon/resources/vrc-quest-performance-1/), [Performance.3](https://developers.meta.com/horizon/resources/vrc-quest-performance-3/), thermal collapse on Quest 3.

| Do not | Design instead |
| --- | --- |
| Author to desktop 120+ Hz and hope | Quest 3 soak ≥10 min ([quest-3-on-device-qa](../quest-3-on-device-qa.md)). WebXR: studio **90 Hz** request |
| Black screen / 2D spinner for >4 s after Store launch | VR loading or head-tracked scene immediately |
| Scan meshes as collision + 4K albedos in Browser | [photoreal-realtime](../../performance/photoreal-realtime.md) + KTX2; visual ≠ collider ([ADR 0004](../../../studio/adr/0004-asset-interaction-architecture.md)) |
| Native Unity budgets copied into WebXR | Browser GPU ≠ native OpenXR path ([webxr-vs-native.md](webxr-vs-native.md)) |

**TODO (verify-on-fetch):** current Performance.1 fps floor and allowed Hz before arguing with a reviewer.

---

## 5. Permissions and piracy leftovers

**Fails:** [Security.2](https://developers.meta.com/horizon/resources/vrc-quest-security-2/); entitlement mismatch notes on [Security.1](https://developers.meta.com/horizon/resources/vrc-quest-security-1/) / [common failures](https://developers.meta.com/horizon/resources/publish-common-vrc-failures/).

| Do not | Design instead |
| --- | --- |
| Template manifest with `READ_CONTACTS` / SMS / fine location “just in case” | Min permissions; **TODO verify-on-fetch** prohibited vs review-requiring lists |
| Crash if the user denies mic | Feature-off path or an in-VR explanation |
| Entitlement check against the wrong App ID / package | Map package ↔ App ID on first channel upload; handle **failure in-app** (check does nothing by itself) |
| Skip Digital Asset Links on an immersive PWA | Broken DAL ⇒ **no launch** ([pwa-packaging](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)) |

Security.1 is **recommended (+)** on the 2026-05-01 VRC table, not a ✓ — still a common fail when attempted. **TODO (verify-on-fetch)** current tick.

---

## 6. Stuck, pause, sharing, tracking

**Fails:** [Functional.1–4](https://developers.meta.com/horizon/resources/publish-quest-req/#functional-requirements), [.12](https://developers.meta.com/horizon/resources/vrc-quest-functional-12/), [Input.4](https://developers.meta.com/horizon/resources/vrc-quest-input-4/), [App Sharing policy §3.4](https://developers.meta.com/horizon/policy/app-policies/).

| Do not | Design instead |
| --- | --- |
| Soft-lock on a failed grab / empty inventory | Illegal transitions nack; drop never dead-ends ([quality-bar](../../../studio/quality-bar.md) interactive assets) |
| Single-player keeps simulating when OS pauses (guardian, dashboard) | Honor pause for single-player (Functional.2) |
| Saves tied to a single Android user / ignores App Sharing | Per-entitled-user saves (Functional.12) |
| On focus loss: freeze frame, show ghost controllers, eat input | Keep rendering; hide app hands/controllers; ignore input (Input.4) |
| Hands-only tutorial when metadata says controllers | Metadata = reality (Tracking.2). Core loop works with Touch ([ADR 0003](../../../studio/adr/0003-interaction.md)) |
| App actions bound to the system hand gesture | Reserve it (Input.8) |

---

## 7. Commerce, ads, and “store within a store”

**Fails:** [App policies §1–3](https://developers.meta.com/horizon/policy/app-policies/), [VRC Ads](https://developers.meta.com/horizon/resources/publish-quest-req/#ads-requirements).

| Do not | Design instead |
| --- | --- |
| Stripe / PayPal / crypto checkout for digital items in a Store APK | Platform IAP (native) or Digital Goods (Store WebXR PWA only) |
| Hosted WebXR IAP “we’ll add Store later” | Either no IAP, or choose `webxr-pwa-store` / native **now** |
| Immersive / head-tracked ads | Not allowed (Ads.3 / policy format rules) |
| Ads by default in a game | Ads need a written Meta exception or a qualifying Windows-into-service / social app |
| App that only launches other paid experiences | Store-within-store limits (§3.1) |
| Cloud-streamed immersive XR without Meta’s written OK | [Streaming VRCs](https://developers.meta.com/horizon/resources/publish-quest-req/#streaming-requirements) + policy §3.2; under-13 cloud immersive is forbidden (Streaming.4) |

WebXR PWA IAP: subscriptions documented as **unsupported** on [ps-iap](https://developers.meta.com/horizon/documentation/web/ps-iap/) at last fetch — **TODO verify-on-fetch**. Do not brief a WebXR battle-pass that needs Platform subscriptions.

---

## 8. Age / UGC / content policy landmines

**Fails:** [age-groups](https://developers.meta.com/horizon/resources/age-groups/), [Content Guidelines](https://developers.meta.com/horizon/policy/content-guidelines/), [VRC.Content.1–3](https://developers.meta.com/horizon/resources/publish-quest-req/#content-requirements), [Code of Conduct](https://www.meta.com/legal/quest/code-of-conduct-for-virtual-experiences/).

| Do not | Design instead |
| --- | --- |
| Mixed Ages certification without Get Age Category API | Pick **Teens and Adults (13+)** unless you will implement the API on a **native/Platform** path |
| Mixed Ages + `webxr-hosted` | Path conflict — change age group or platform |
| Voice/text/UGC multiplayer with no report from the Meta button | Build reporting before netcode ([Content.3](https://developers.meta.com/horizon/resources/vrc-content-3/)) |
| Real-money gambling, porn-for-gratification, hate, fraud, cash-out of virtual items | Read the **live** Content Guidelines — **TODO verify-on-fetch** full list. Mature content ≈ film R-rating per Meta’s prose; marketing assets are stricter |
| IARC “everyone” + in-app gore/IAP-to-children | Questionnaire must match the build (Content.2) |
| Child-directed app using blocked Platform social APIs | Check current blocked-feature list |

Meta may allow documentary/educational treatment of otherwise sensitive historical material — do not assume; cite the live page in the brief.

---

## 9. Wrong product class

**Fails:** [App policies §4.3–4.6](https://developers.meta.com/horizon/policy/app-policies/).

| Do not | Design instead |
| --- | --- |
| Paid/IAP/ads app that is a single 360 video or a few 2D clips | Real interactive loop, or publish video to Meta’s video surfaces instead |
| VPN / password manager without Meta’s written permission | Out of scope for this studio |
| Mimicking Horizon OS notifications / home UI | Distinct app chrome (also Ads.7) |
| Branding with Meta/Quest wordmarks inside the world | Policy §6.1 exceptions only (system “Quit to Home” copy, official controller meshes) |

---

## 10. Path confusion (this repo’s own DQ)

Not a Meta VRC — still kills delivery:

1. Scaffolding Vite+Three **and** Unity because the user said “Quest app”
2. Auto-`requestSession` on a hosted page (illegal) because a PWA guide said to
3. Promising Store IAP on a Browser bookmark
4. Using this repo’s WebXR draw-call ceiling as a native Unity VRC defense
5. Claiming store confidence from a green [requirements-pass](requirements-pass.md) alone

Fix: lock [webxr-vs-native.md](webxr-vs-native.md) in interrogation Q1; refuse to generate files until [ADR 0006](../../../studio/adr/0006-store-gate-before-build.md) passes.
