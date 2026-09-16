# WebXR vs native Horizon Store — choose before build

Agents must lock a **platform path** in the [app brief](../../../studio/briefs/_template/app-brief.md) before generating a scaffold ([ADR 0006](../../../studio/adr/0006-store-gate-before-build.md)). Mixing paths mid-build (Three.js WebXR *and* a Unity APK “just in case”) is how projects miss both Browser QA and Store VRCs.

This repo implements and documents **path A / B**. Path C is a *decision record only* here — native Unity/Unreal/Spatial SDK code does not live in this knowledge base.

## The three distribution paths

| Path | What the user launches | Store listing? | This repo? |
| --- | --- | --- | --- |
| **A. Hosted WebXR** | HTTPS URL in **Meta Quest Browser** (bookmark, Web Launch, optional Browser new-tab consideration) | No — not a Horizon Store app | **Yes** — `examples/`, fundamentals, Quest 3 Browser gate |
| **B. WebXR PWA** | Store icon → Trusted Web Activity wrapping the hosted site; immersive PWAs should `requestSession` on launch | **Yes** — same Store review as other APKs, plus PWA packaging | **Partial** — WebXR app is in-repo; Bubblewrap/APK + Dashboard submission is extra |
| **C. Native** | Installed APK (Unity / Unreal / native / Spatial SDK) via Store | **Yes** — canonical native Store path | **No** — record the choice and send the team to Meta’s engine docs |

Official split for web:

- Browser can open hosted 2D, screen-based 3D, and immersive WebXR. Distribution options: hosted URL **or** optional PWA packaging for the Store ([Meta Quest Browser overview](https://developers.meta.com/horizon/documentation/web/), [PWA overview](https://developers.meta.com/horizon/documentation/web/pwa-overview/)).
- A PWA is a distribution option, not a different content category. `2D` vs `immersive` is an app *mode* (`horizonOSAppMode`): immersive only when the packaged app launches into a WebXR session ([PWA overview](https://developers.meta.com/horizon/documentation/web/pwa-overview/), [Configure an immersive WebXR PWA](https://developers.meta.com/horizon/documentation/web/pwa-webxr/)).

Official native Store path: engine project + Meta XR / Platform SDK + signed 64-bit APK + Dashboard / MQDH upload ([Unity: prepare for publish](https://developers.meta.com/horizon/documentation/unity/unity-prepare-for-publish/), [Submit your app](https://developers.meta.com/horizon/resources/publish-submit/), [VRC guidelines](https://developers.meta.com/horizon/resources/publish-quest-req/)).

## What you get — and give up

### A. Hosted WebXR (this studio’s default for *examples*)

**Use when:** you want a URL, fast iteration, web stack (Vite + Three.js per [ADR 0001](../../../studio/adr/0001-framework.md)), and you are honest that users open **Quest Browser**.

| Have | Do not have (unless you later do B) |
| --- | --- |
| Standards WebXR (`navigator.xr`, `requestSession` on **user gesture**) | Horizon Store PDP, ranking, IAP via Platform / Digital Goods |
| Studio Quest 3 @ 90 Hz Browser gate | Platform entitlement, Friends, Achievements, native IAP |
| HTTPS + Permissions-Policy as in [shipping README](../README.md) | APK packaging VRCs (manifest, v2 signing, 64-bit binary size) as a *Store upload* |

Meta documents that a regular Browser page **must not** auto-enter immersive VR on load: `requestSession` requires user activation. A Store PWA icon click is treated as that activation so immersive PWAs can launch straight into XR ([pwa-webxr](https://developers.meta.com/horizon/documentation/web/pwa-webxr/)). Do not copy PWA auto-`requestSession` into a hosted page.

### B. WebXR PWA on the Store

**Use when:** the product is WebXR **and** you need a Store listing (discovery, paid app, or IAP).

| Have | Constraints |
| --- | --- |
| Same WebGL/WebXR engine as Browser — test in Browser first ([pwa-webxr](https://developers.meta.com/horizon/documentation/web/pwa-webxr/)) | You still upload a **signed APK**. Packaging VRCs apply ([VRC Packaging](https://developers.meta.com/horizon/resources/publish-quest-req/)). |
| Site updates can ship without a new APK if the TWA loads the live origin | Digital Asset Links must verify; immersive PWAs **do not launch** if verification fails ([pwa-packaging](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)). |
| IAP via Digital Goods API **in Store-installed WebXR PWAs** ([ps-iap](https://developers.meta.com/horizon/documentation/web/ps-iap/)) | Meta documents Digital Goods **only** for those PWAs, not arbitrary Browser tabs. **TODO (verify-on-fetch):** subscription support — Meta’s IAP page currently states subscriptions are not supported. |

Bubblewrap (Meta Quest fork) generates the Android project from a hosted Web App Manifest ([pwa-packaging](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)). **TODO (verify-on-fetch):** current `@meta-quest/bubblewrap-cli` version and Node requirement on that page.

### C. Native Unity (or Unreal / native / Spatial SDK)

**Use when:** you need Platform SDK depth (matchmaking, full IAP/subscriptions as documented for that engine, App Sharing edge cases, SpaceWarp, native compositor features) or the team is a Unity shop shipping an APK as source of truth.

| Have | Constraints |
| --- | --- |
| Meta XR Core / Platform SDK, MQDH / OVR Platform upload ([ps-get-started](https://developers.meta.com/horizon/documentation/unity/ps-get-started/)) | This repo’s Three.js examples are **not** the app. Do not “port later.” |
| VRC performance tables for *native* Quest (different from Browser) | Studio WebXR draw/tri defaults in [quest-3-target](../quest-3-target.md) are **Browser-conservative** and must not be treated as native Unity budgets. |
| Store IAP = Platform IAP ([App policies §1.1](https://developers.meta.com/horizon/policy/app-policies/)) | Off-store commerce in a Store-distributed app is a policy violation unless an listed exception applies. |

Unity publish prep currently documents IL2CPP, **ARM64**, unique `com.Company.App` package name, and **minimum Android API 29** ([unity-prepare-for-publish](https://developers.meta.com/horizon/documentation/unity/unity-prepare-for-publish/)). **TODO (verify-on-fetch):** min/target API and supported Unity / SDK versions on [VRC.Quest.Packaging.4](https://developers.meta.com/horizon/resources/vrc-quest-packaging-4/).

## Decision rules (agents)

Lock `platform.path` to exactly one of `webxr-hosted` | `webxr-pwa-store` | `native-unity` | `native-unreal` | `native-other`.

1. **Need Store listing or Platform IAP?** If no → `webxr-hosted`. If yes, continue.
2. **Team and runtime are web (Three/Babylon/A-Frame)?** → `webxr-pwa-store`. Plan Browser QA *and* APK/VRC/PWA packaging.
3. **Team is Unity/Unreal or needs Platform SDK features Digital Goods does not cover?** → native. Stop generating WebXR scaffolds in this repo; brief still required.
4. **Undecided** → interrogation is incomplete. **No scaffold.**

`webxr-hosted` **plus later PWA** is allowed only if the brief says so up front (`distribution.laterPwa: true`) so session-entry (gesture vs icon) and IAP are designed correctly.

## Performance and comfort are not the same number

| Layer | Quest 3 bar in *this* studio | Meta Store floor (native / PWA APK) |
| --- | --- | --- |
| Frame | **90 Hz** ship / 72 fallback in Quest **Browser** ([quest-3-target](../quest-3-target.md), [WebXR frame rate](https://developers.meta.com/horizon/documentation/web/webxr-frames/)) | [VRC.Quest.Performance.1](https://developers.meta.com/horizon/resources/vrc-quest-performance-1/): allowed refresh rates and a **minimum rendering fps**. **TODO (verify-on-fetch):** live Hz list and fps floor on that VRC (page has changed historically). |
| Comfort | Studio tiers A/B/C ([comfort](../../design/comfort.md), [ADR 0002](../../../studio/adr/0002-locomotion.md)) | Store **Comfortable / Moderate / Intense** on the *default* experience ([App policies §5.1](https://developers.meta.com/horizon/policy/app-policies/)) |

A title can pass VRC Performance.1 and still fail this studio’s 90 Hz Browser soak. A title can be studio Tier A and still be Store “Moderate” if default motion is more than Meta’s Comfortable definition. Map both in the brief; do not equate them.

## Input and session differences that bite

| Topic | Hosted WebXR | Immersive WebXR PWA | Native |
| --- | --- | --- | --- |
| Enter VR | User gesture on the page ([MDN requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession)) | Icon click may count as activation; Meta wants no 2D landing page ([pwa-webxr](https://developers.meta.com/horizon/documentation/web/pwa-webxr/)) | Activity launches immersive |
| Hands / controllers | `XRInputSource`; optional `hand-tracking` feature | Same WebXR | Interaction SDK / OpenXR |
| Store input VRCs | N/A until packaged | Apply (focus-aware, hand↔controller switch, reserved system gesture) | Apply |
| Recenter | Reference space + in-app control ([ADR 0002](../../../studio/adr/0002-locomotion.md)); Store [VRC.Quest.Functional.9](https://developers.meta.com/horizon/resources/vrc-quest-functional-9/) if Local space | Same if Store | Same |

## Honest limitation

Choosing B or C does **not** make Meta approve the app. Choosing A does **not** make a Browser URL a Store app. Agents that skip this page and emit a Unity project *or* a Vite app “to be decided” have failed the gate.
