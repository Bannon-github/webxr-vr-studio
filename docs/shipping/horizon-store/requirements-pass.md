# Requirements pass — Meta Horizon Store checklist

Agent-runnable checklist for a filled [app brief](../../../studio/briefs/_template/app-brief.md). Work **top to bottom**. Cite the live Meta page, not this file, if they disagree.

**Not a Meta review.** Passing here means: ambiguities closed, known required VRC *categories* have an owner, and TODOs are explicit. Meta still reviews binaries, assets, privacy text, and content.

**How to mark**

| Mark | Meaning |
| --- | --- |
| `[x]` | Verified against the *current* official page **and** the brief/design |
| `[ ]` | Open — **blocks scaffold** if the row is required for the chosen path |
| `n/a` | Does not apply (example: packaging VRCs on hosted WebXR with no PWA) |
| `TODO verify-on-fetch` | Policy or number must be re-read on Meta’s page before treating as current |

Primary hardware: **Quest 3**. Studio Browser bar: [quest-3-target](../quest-3-target.md). Store VRCs: [publish-quest-req](https://developers.meta.com/horizon/resources/publish-quest-req/) (table last noted in-repo from a 2026-05-01 fetch — **re-fetch**).

---

## 0. Path and scope

- [ ] `platform.path` is one of `webxr-hosted` | `webxr-pwa-store` | `native-unity` | `native-unreal` | `native-other` ([webxr-vs-native.md](webxr-vs-native.md))
- [ ] `distribution.horizonStore` matches that path (`false` only for `webxr-hosted` without later PWA)
- [ ] Target device is Quest 3 (3S in-family). Not Quest 2-as-gate, not 207/240 Hz
- [ ] Immersive vs 2D/panel app type is named — **required VRC sets differ** ([publish-submit](https://developers.meta.com/horizon/resources/publish-submit/), [VRC table](https://developers.meta.com/horizon/resources/publish-quest-req/))

If `horizonStore` is false, complete §1–§4 and §8 (comfort / age / privacy / content as they still apply to a public URL), mark §5–§7 and packaging rows `n/a`, and continue.

---

## 1. Age rating and youth

Official: [App policies §5.2](https://developers.meta.com/horizon/policy/app-policies/), [age-groups](https://developers.meta.com/horizon/resources/age-groups/), [IARC via Dashboard](https://developers.meta.com/horizon/policy/app-policies/).

- [ ] **IARC** questionnaire planned (Dashboard → Submission Info → Content Ratings). Required for Store apps. South Korea: GRAC — Meta states IARC via their Dashboard also yields GRAC ([§5.2.3](https://developers.meta.com/horizon/policy/app-policies/)). **TODO (verify-on-fetch):** current Dashboard navigation and GRAC wording.
- [ ] **Age group self-certification** chosen and matches actual audience — do not infer solely from IARC ([age-groups](https://developers.meta.com/horizon/resources/age-groups/)). Typical Dashboard buckets (re-verify labels): **Teens and Adults (13+)**, **Mixed Ages**, **Children (under 13 / 10–12)**.
- [ ] **Children under 10:** Meta’s age-groups page requires apps **not** to permit use by children under 10. **TODO (verify-on-fetch):** current “no children under 10” rule and how it is enforced for WebXR PWAs vs native.
- [ ] **Mixed Ages** ⇒ Get Age Category API (Platform SDK) — **required** for that certification ([age-groups](https://developers.meta.com/horizon/resources/age-groups/), [Get Age Category API](https://developers.meta.com/horizon/documentation/unity/ps-get-age-category-api/)). Hosted WebXR **cannot** call Platform SDK; Mixed Ages + `webxr-hosted` is a **path conflict** unless you change path or age group.
- [ ] **Children-directed** apps: Platform SDK feature blocks apply ([age-groups](https://developers.meta.com/horizon/resources/age-groups/)). **TODO (verify-on-fetch):** current blocked-feature list.
- [ ] Ads / social / UGC / IAP called out in the brief so IARC answers will match the build ([VRC.Content.2](https://developers.meta.com/horizon/resources/vrc-content-2/) metadata must match in-app content)

---

## 2. Privacy, data use, DUC

Official: [VRC Privacy](https://developers.meta.com/horizon/resources/publish-quest-req/#privacy-policy-requirements), [publish-app-requirements](https://developers.meta.com/horizon/resources/publish-app-requirements/), [Developer Data Use Policy](https://developers.meta.com/horizon/policy/data-use/), [Data Use Checkup](https://developers.meta.com/horizon/resources/publish-data-use/).

Store-required privacy VRCs (✓ on Horizon Store column as of the 2026-05-01 VRC table — **re-fetch**):

| VRC | Agent check |
| --- | --- |
| [Privacy.1](https://developers.meta.com/horizon/resources/vrc-quest-privacy-1/) | Live URL to a policy **owned by the app’s team**. Not a 404, not a homepage redirect, not hosted on another VR store. Meta re-checks after publish. |
| [Privacy.2](https://developers.meta.com/horizon/resources/vrc-quest-privacy-2/) | What data is collected (including mic / camera / hand / account / analytics) |
| [Privacy.3](https://developers.meta.com/horizon/resources/vrc-quest-privacy-3/) | How that data is used |
| [Privacy.4](https://developers.meta.com/horizon/resources/vrc-quest-privacy-4/) | How **any** user can request deletion; **no fee** for deletion. Or a clear “we do not collect/store” statement if true |
| [Privacy.5](https://developers.meta.com/horizon/resources/vrc-quest-privacy-5/) | Team/app clear data-protection checks |

Checklist:

- [ ] Privacy policy URL reserved (even if unpublished). Contents match the brief’s data inventory
- [ ] Deletion path is operational, not “email us maybe”
- [ ] **DUC** planned iff the app uses Platform SDK features subject to DDUP ([publish-data-use](https://developers.meta.com/horizon/resources/publish-data-use/)). WebXR PWA IAP counts — Meta’s IAP page requires DUC before Digital Goods ([ps-iap](https://developers.meta.com/horizon/documentation/web/ps-iap/))
- [ ] Analytics: DDUP requires aggregated/anonymized analytics; sharing user data needs express user consent ([publish-data-use](https://developers.meta.com/horizon/resources/publish-data-use/))
- [ ] Crash/logging does not record secrets or unnecessary PII (studio [shipping README](../README.md))

Privacy.1 and Privacy.4 are called out by Meta as **commonly failed** ([Privacy.1](https://developers.meta.com/horizon/resources/vrc-quest-privacy-1/), [Privacy.4](https://developers.meta.com/horizon/resources/vrc-quest-privacy-4/), [common VRC failures](https://developers.meta.com/horizon/resources/publish-common-vrc-failures/)).

---

## 3. Comfort rating vs studio locomotion

Official Store rating: [App policies §5.1](https://developers.meta.com/horizon/policy/app-policies/) — assign **Comfortable**, **Moderate**, or **Intense** based on the **default** experience. Consumer-facing definitions: [Quest help](https://www.meta.com/help/quest/331713305046406/).

Meta’s policy wording (paraphrase; quote the live page in the brief):

- **Comfortable** — generally avoids camera movement, player motion, or disorienting effects; often a fixed camera
- **Moderate** — more camera / player motion
- **Intense** — first-person camera motion, acceleration, or significant player motion

Studio implementation defaults: [comfort](../../design/comfort.md), [ADR 0002](../../../studio/adr/0002-locomotion.md) (Tier A teleport + snap turn).

- [ ] `comfort.storeRating` set from **defaults**, not from a buried opt-in smooth-loco setting
- [ ] `comfort.studioTier` is A unless an ADR exception exists
- [ ] Settings still expose turn / loco preferences ([quality-bar](../../../studio/quality-bar.md))
- [ ] No forced artificial pitch
- [ ] Head-locked UI avoided ([VRC.Quest.Functional.10](https://developers.meta.com/horizon/resources/vrc-quest-functional-10/) — recommended)
- [ ] Recenter / reset forward orientation if using a local tracking space ([VRC.Quest.Functional.9](https://developers.meta.com/horizon/resources/vrc-quest-functional-9/) — required for immersive Store)

**TODO (verify-on-fetch):** whether Meta reviewers recategorize comfort ratings vs developer self-assignment on the current Dashboard.

---

## 4. Performance (Store floor ≠ studio Browser gate)

### Store VRC (APK / immersive Store apps)

[VRC Performance](https://developers.meta.com/horizon/resources/publish-quest-req/#performance-requirements):

| VRC | Notes |
| --- | --- |
| [Performance.1](https://developers.meta.com/horizon/resources/vrc-quest-performance-1/) | Required for immersive Store: allowed refresh rates + minimum rendering fps. **TODO (verify-on-fetch):** live allowed Hz set and fps floor (historically updated; 96/100 Hz called out as planned). |
| Performance.2 | Retired |
| [Performance.3](https://developers.meta.com/horizon/resources/vrc-quest-performance-3/) | Head-tracked graphics in-headset within **4 seconds** of launch **or** a loading indicator in VR |
| [Performance.4](https://developers.meta.com/horizon/resources/vrc-quest-performance-4/) | Recommended: ≥85% render scale for most of the experience |

Native display-rate docs (not Browser): [Set display refresh rates](https://developers.meta.com/horizon/documentation/native/android/mobile-display-refresh-rate/). Default native rate is documented as 72 Hz; Quest 3 lists 72/80/90/120 among supported rates on that table — **TODO (verify-on-fetch)** before quoting in a native brief.

- [ ] Launch: VR world or VR loading indicator ≤4 s (Store) — design it now, do not retrofit
- [ ] Refresh-rate target named for the path (studio WebXR: request **90 else 72** in Browser)

### Studio WebXR / Quest 3 Browser (always, for paths A/B)

- [ ] [quest-3-target](../quest-3-target.md) budgets accepted (draw/tri/texture/FFR are **studio defaults**, not Meta guarantees)
- [ ] On-device soak plan: [quest-3-on-device-qa](../quest-3-on-device-qa.md) — cells stay blank until a headset run
- [ ] No XR frame-loop allocations ([quality-bar](../../../studio/quality-bar.md))

Do **not** copy native Unity triangle/draw tables into a WebXR brief.

---

## 5. Input, tracking, focus (Store)

[VRC Input](https://developers.meta.com/horizon/resources/publish-quest-req/#input-requirements) / [Tracking](https://developers.meta.com/horizon/resources/publish-quest-req/#tracking-requirements). **TODO (verify-on-fetch):** required vs recommended ticks on the live table.

Required (✓ immersive Store as of 2026-05-01 table):

- [ ] [Input.4](https://developers.meta.com/horizon/resources/vrc-quest-input-4/) **Focus-aware:** keep rendering on focus loss, hide app hands/controllers, ignore input
- [ ] [Input.7](https://developers.meta.com/horizon/resources/vrc-quest-input-7/) If hands advertised: respect controller ↔ hands switch
- [ ] [Input.8](https://developers.meta.com/horizon/resources/vrc-quest-input-8/) If hands advertised: **system gesture reserved** — must not fire app actions
- [ ] [Tracking.1](https://developers.meta.com/horizon/resources/vrc-quest-tracking-1/) Submission metadata play mode (sitting / standing / roomscale) matches the app
- [ ] [Tracking.2](https://developers.meta.com/horizon/resources/vrc-quest-tracking-2/) Submission metadata input modes match supported input
- [ ] [Functional.5](https://developers.meta.com/horizon/resources/vrc-quest-functional-5/) Positional **and** orientation tracking
- [ ] [Functional.6](https://developers.meta.com/horizon/resources/vrc-quest-functional-6/) Only Meta Quest headsets/controllers in title and Store assets — no other-platform hardware

Studio interaction defaults (paths A/B): [ADR 0003](../../../studio/adr/0003-interaction.md) — `select` = use, `squeeze` = grab. Aligns with recommended [Input.2](https://developers.meta.com/horizon/resources/vrc-quest-input-2/) (grip to pick up).

- [ ] Controllers required for core loop; hands optional unless the brief advertises hands-only
- [ ] Menu button mapping considered ([Input.1](https://developers.meta.com/horizon/resources/vrc-quest-input-1/) recommended: left Touch **menu**)

---

## 6. Permissions and packaging (Store APK: native or PWA)

### Permissions

[VRC.Quest.Security.2](https://developers.meta.com/horizon/resources/vrc-quest-security-2/) — **required:** minimum permissions; none unsupported/prohibited; deny must not crash.

- [ ] Permission inventory in the brief (microphone, camera/passthrough, storage, internet, billing, …)
- [ ] Each permission has a user-visible purpose
- [ ] Runtime deny: continue with reduced features **or** an on-screen explanation — no freeze
- [ ] **TODO (verify-on-fetch):** [prohibited permissions](https://developers.meta.com/horizon/resources/vrc-quest-security-2/) and [review-requiring permissions](https://developers.meta.com/horizon/resources/permissions-review-required) lists — do not copy stale Android permission names from memory

WebXR hosted: browser permission prompts (camera/mic) still need privacy-policy coverage even when there is no AndroidManifest.

### Packaging (required ✓ Store as of 2026-05-01 table — **re-fetch sizes and signing**)

| VRC | Agent check |
| --- | --- |
| [Packaging.1](https://developers.meta.com/horizon/resources/vrc-quest-packaging-1/) | Release manifest ([publish-mobile-manifest](https://developers.meta.com/horizon/resources/publish-mobile-manifest/)) |
| [Packaging.2](https://developers.meta.com/horizon/resources/vrc-quest-packaging-2/) | APK signature scheme **v2** |
| [Packaging.3](https://developers.meta.com/horizon/resources/vrc-quest-packaging-3/) | Do not require Android features Quest lacks |
| [Packaging.4](https://developers.meta.com/horizon/resources/vrc-quest-packaging-4/) | Supported SDK / engine version — **TODO verify-on-fetch** current allowlist |
| [Packaging.5](https://developers.meta.com/horizon/resources/vrc-quest-packaging-5/) | APK **&lt; 1 GB**, OBB **&lt; 4 GB** as currently published — **TODO verify-on-fetch** |
| [Packaging.6](https://developers.meta.com/horizon/resources/vrc-quest-packaging-6/) | **64-bit** binaries |

- [ ] Unique package name; versionCode monotonic ([unity-prepare-for-publish](https://developers.meta.com/horizon/documentation/unity/unity-prepare-for-publish/) for Unity; PWA via Bubblewrap signing ([pwa-packaging](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)))
- [ ] PWA: `/.well-known/assetlinks.json` on every trusted origin
- [ ] [Security.1](https://developers.meta.com/horizon/resources/vrc-quest-security-1/) entitlement check within 10 s of launch — VRC table marks this **recommended (+)**, not ✓, but Meta lists it among [commonly failed VRCs](https://developers.meta.com/horizon/resources/publish-common-vrc-failures/). **TODO (verify-on-fetch):** required vs recommended on the live table. Plan the check for Store APKs unless the current VRC says otherwise.

---

## 7. Store listing assets and publishing copy

Official specs: [asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/) (page last_updated 2026-05-11 at last fetch). **TODO (verify-on-fetch):** every pixel size and count below.

Asset VRCs: [VRC Asset](https://developers.meta.com/horizon/resources/publish-quest-req/#asset-requirements). Meta flags asset VRCs as a frequent fail ([common VRC failures](https://developers.meta.com/horizon/resources/publish-common-vrc-failures/)).

Snapshot of branded specs from that fetch (treat as **hints**; Dashboard is authority):

| Asset | Ratio | Size | Format |
| --- | --- | --- | --- |
| Hero Cover | 10:3 | 3000×900 | 24-bit PNG |
| Cover Landscape | 16:9 | 2560×1440 | 24-bit PNG |
| Cover Square | 1:1 | 1440×1440 | 24-bit PNG |
| Cover Portrait | 7:10 | 1008×1440 | 24-bit PNG |
| Mini Landscape | 3:1 | 1080×360 | 24-bit PNG |
| Logo (optional) | variable | max 9000×1440 | **32-bit PNG, transparent** ([Asset.1](https://developers.meta.com/horizon/resources/vrc-quest-asset-1/)) |
| Icon | 1:1 | 512×512 | 24-bit PNG, **no transparency**, square corners |
| Spatialized icon | 1:1 | 180×180 | 24-bit PNG; foreground transparent |
| Screenshots | 16:9 | 2560×1440 | 24-bit PNG; **5 unique** in-experience shots, no banners/text |
| Trailer | 16:9 | 1080p–2K | MP4/H.264/AAC; **30 s–2 min** ([Asset.7](https://developers.meta.com/horizon/resources/vrc-quest-asset-7/) caps length at 2 min) |
| Trailer cover | 16:9 | 2560×1440 | 24-bit PNG |

Design rules (required unless marked +):

- [ ] Exact app title on branded covers (icon excepted); title-text in **safe area**; no badges/banners/taglines/pricing ([asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/), [Asset.2](https://developers.meta.com/horizon/resources/vrc-quest-asset-2/))
- [ ] [Asset.3](https://developers.meta.com/horizon/resources/vrc-quest-asset-3/) recommended: no text in top/bottom 20%
- [ ] Screenshots = actual gameplay; no extra logos ([Asset.5](https://developers.meta.com/horizon/resources/vrc-quest-asset-5/))
- [ ] No other-platform headsets/controllers/logos in description, screenshots, or video ([Asset.6](https://developers.meta.com/horizon/resources/vrc-quest-asset-6/), [Functional.6](https://developers.meta.com/horizon/resources/vrc-quest-functional-6/))
- [ ] Trailer: Quest hardware + [Hardware Safety](https://www.meta.com/quest/safety-center/) (straps, play area)
- [ ] Publishing URLs live: website, support, ToS ([VRC Publishing](https://developers.meta.com/horizon/resources/publish-quest-req/#publishing-requirements))
- [ ] Name / short / long description / keywords follow [content guidelines](https://developers.meta.com/horizon/policy/content-guidelines/) and [brand guidelines](https://developers.meta.com/horizon/resources/publish-brand-guidelines/) ([Publishing.4–8](https://developers.meta.com/horizon/resources/publish-quest-req/#publishing-requirements))
- [ ] Avoid “VR” in the title — Meta calls it redundant on Quest ([asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/))

Bleed templates: Meta documents downloads from the asset-guidelines page (URL on that page — **TODO verify-on-fetch** current template link).

---

## 8. Content, UGC, ads, IAP, functional

- [ ] Developer content vs [Content Guidelines](https://developers.meta.com/horizon/policy/content-guidelines/) ([VRC.Content.1](https://developers.meta.com/horizon/resources/vrc-content-1/)) — **TODO (verify-on-fetch):** full prohibition list on the live policy page (pornography, hate, fraud, real-money gambling / cash-out, medical-device claims, …)
- [ ] Store metadata matches the binary ([VRC.Content.2](https://developers.meta.com/horizon/resources/vrc-content-2/))
- [ ] **UGC or multiplayer:** reporting form always reachable from the **Meta button** ([VRC.Content.3](https://developers.meta.com/horizon/resources/vrc-content-3/)); hide-undesired-content is recommended ([Content.4](https://developers.meta.com/horizon/resources/vrc-content-4/)). Ongoing moderation vs [Code of Conduct for Virtual Experiences](https://www.meta.com/legal/quest/code-of-conduct-for-virtual-experiences/)
- [ ] **IAP:** Store-distributed apps must use Platform IAP (native) or Digital Goods (WebXR PWA) ([App policies §1.1](https://developers.meta.com/horizon/policy/app-policies/), [ps-iap](https://developers.meta.com/horizon/documentation/web/ps-iap/)). No side-loaded Stripe/PayPal for digital goods
- [ ] **Ads:** default **no ads** unless written agreement or Windows-into-service / social-media exceptions ([App policies §2.1](https://developers.meta.com/horizon/policy/app-policies/)). If ads: VRC Ads.1–7 (not stereoscopic/head-tracked/immersive; dismissible; Contains Ads label)
- [ ] [Functional.1](https://developers.meta.com/horizon/resources/vrc-quest-functional-1/) install/run without crash/freeze
- [ ] [Functional.2](https://developers.meta.com/horizon/resources/vrc-quest-functional-2/) single-player **pauses** when Horizon OS requests pause
- [ ] [Functional.3](https://developers.meta.com/horizon/resources/vrc-quest-functional-3/) user never stuck
- [ ] [Functional.4](https://developers.meta.com/horizon/resources/vrc-quest-functional-4/) do not lose user data
- [ ] [Functional.12](https://developers.meta.com/horizon/resources/vrc-quest-functional-12/) **App Sharing / multi-user:** full function for multiple entitled users ([App policies §3.4](https://developers.meta.com/horizon/policy/app-policies/) — App Sharing is required unless Meta agrees otherwise)
- [ ] [Functional.14](https://developers.meta.com/horizon/resources/vrc-quest-functional-14/) if the app can launch in passthrough: passthrough loading when coming from MR Home
- [ ] Paid / IAP / ads / Platform features ⇒ not “limited utility” ([App policies §4.3](https://developers.meta.com/horizon/policy/app-policies/))
- [ ] Not a thin wrapper for a handful of 2D videos or a single 360 clip ([§4.5](https://developers.meta.com/horizon/policy/app-policies/))
- [ ] Do not mimic / override Horizon OS system UI ([§4.4](https://developers.meta.com/horizon/policy/app-policies/), Ads.7)

Recommended a11y VRCs exist ([Accessibility.1–9](https://developers.meta.com/horizon/resources/publish-quest-req/#accessibility-requirements)); studio still requires seated mode and non-audio-only critical info ([quality-bar](../../../studio/quality-bar.md)).

---

## 9. Gate result (copy onto the brief)

```
storeGate:
  ranOn: <ISO date>
  vrcPageFetched: <ISO date>
  path: <platform.path>
  result: pass | fail | n/a-browser-only
  openTodos: [<verify-on-fetch ids>]
  blockerNotes: <or "none">
```

- `fail` or unanswered required rows → **no scaffold** ([ADR 0006](../../../studio/adr/0006-store-gate-before-build.md))
- `n/a-browser-only` is a pass **only** for `webxr-hosted` with Store explicitly out of scope
- `pass` still means “ready to build toward submission,” not “will be approved”
