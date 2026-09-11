# App interrogation (single stream)

Agents run this **in order** when asked to build a VR app. Do not skip, batch, or “assume reasonable defaults” for unanswered items. Each answer writes a field on [`briefs/_template/app-brief.md`](briefs/_template/app-brief.md) / [`app-brief.schema.json`](briefs/_template/app-brief.schema.json).

**Stop and wait** if the user cannot answer. Partial briefs do not unlock a scaffold ([ADR 0006](adr/0006-store-gate-before-build.md)).

After Q20, copy the template to `studio/briefs/<appId>/`, fill it, then run [`docs/shipping/horizon-store/requirements-pass.md`](../docs/shipping/horizon-store/requirements-pass.md) and [`disqualification-avoid.md`](../docs/shipping/horizon-store/disqualification-avoid.md).

Primary hardware is **Quest 3**. Do not invent Meta policy numbers in answers — link official pages.

---

## Rules of the stream

1. One question at a time. Quote the **Allowed** set. If the user answers outside it, re-ask.
2. `unknown` / `undecided` is **not** allowed except where the table says so. Those rows are blockers.
3. If a later answer contradicts an earlier lock (example: IAP on `webxr-hosted`), **re-open Q1–Q3** — do not patch silently.
4. Record `interrogation.log[]` (question id, answer, timestamp).
5. Output is the brief, not a chat summary.

---

## Q1 — Platform path (hard fork)

**Ask:** Which runtime and distribution path is this app?

**Why first:** WebXR Browser, WebXR Store PWA, and native Unity/Unreal are different products ([webxr-vs-native](../docs/shipping/horizon-store/webxr-vs-native.md)). Scaffolding the wrong one wastes the rest of the brief.

**Allowed:** `webxr-hosted` | `webxr-pwa-store` | `native-unity` | `native-unreal` | `native-other`

**Brief:** `platform.path`, `platform.engineNotes`

**Blocker if:** anything else, or “both Unity and Three.js.”

If `native-*`: this repo will not emit an engine project. Still finish the brief; point the team at Meta’s engine publish docs.

---

## Q2 — Horizon Store listing

**Ask:** Must this ship as a **Meta Horizon Store** title (searchable PDP, paid/IAP possible), or is a **Browser URL / bookmark / Web Launch** enough?

**Allowed:** `store-required` | `browser-only` | `browser-now-pwa-later`

**Brief:** `distribution.horizonStore` (`true` iff store-required or later PWA), `distribution.laterPwa`

**Conflicts:**

- `browser-only` + `webxr-pwa-store` / `native-*` → re-ask Q1 or Q2
- `store-required` + `webxr-hosted` → change Q1 to `webxr-pwa-store` or native
- `browser-now-pwa-later` → Q1 must be `webxr-hosted` or `webxr-pwa-store`; design session entry and IAP for the *later* PWA rules now

---

## Q3 — App type

**Ask:** Is the product **immersive VR** (full headset world) or a **2D / panel** Horizon OS app?

**Allowed:** `immersive-vr` | `panel-2d` | `mixed-reality-passthrough`

**Brief:** `platform.appType`

**Why:** Required VRC sets differ for immersive vs 2D ([publish-submit](https://developers.meta.com/horizon/resources/publish-submit/)). This studio’s examples are immersive-vr. Panel-2d is out of examples/ scope; still record it.

If `mixed-reality-passthrough`: Q18 (passthrough launch) becomes required.

---

## Q4 — Genre and player fantasy

**Ask:** In one sentence, what does the player **do** in the first five minutes? Name a genre bucket.

**Allowed genre:** `action` | `adventure` | `puzzle` | `simulation` | `social` | `fitness` | `education` | `utility` | `experience` | `other:<word>`

**Brief:** `identity.oneLiner`, `identity.genre`

**Why:** Saturated genres get less review slack ([publish-submit](https://developers.meta.com/horizon/resources/publish-submit/)). The one-liner must be true of the default loop (Content.2).

Reject vibes-only answers (“it’s like a vibe”).

---

## Q5 — Target hardware

**Ask:** Confirm **Quest 3** is the performance and QA gate. Shipping Quest 3S? Quest 2?

**Allowed:** `quest3-only` | `quest3-plus-3s` | `quest3-plus-3s-soak-q2`

**Brief:** `hardware.gate` = `quest3`, `hardware.also[]`

**Not allowed:** Quest 2 as gate; 207/240 Hz; “desktop VR first.”

---

## Q6 — Play mode / tracking

**Ask:** How does the body move in the **default** session? (Store metadata must match — [Tracking.1](https://developers.meta.com/horizon/resources/vrc-quest-tracking-1/).)

**Allowed (multi-select, at least one):** `sitting` | `standing` | `roomscale`

**Brief:** `tracking.playModes[]`, `tracking.defaultPlayMode`

**Follow-up if sitting not included:** How does a seated user complete the core loop? If they cannot, add sitting or fail a11y ([quality-bar](quality-bar.md), [Accessibility.9](https://developers.meta.com/horizon/resources/vrc-quest-accessibility-9/)).

---

## Q7 — Input advertised

**Ask:** What input will Store metadata / the README **claim**? ([Tracking.2](https://developers.meta.com/horizon/resources/vrc-quest-tracking-2/), [Input.7](https://developers.meta.com/horizon/resources/vrc-quest-input-7/))

**Allowed (multi-select, at least `controllers` for this studio):** `controllers` | `hands` | `gamepad`

**Brief:** `input.modes[]`, `input.handsOptional`

**Rules:**

- Core loop must work with **controllers** even if hands are advertised
- If `hands`: system gesture reserved (Input.8); controller↔hands switch (Input.7)
- `gamepad` alone is not the studio default

---

## Q8 — Locomotion default (studio + Store comfort)

**Ask:** How does the player translate and turn **on first run**, before opening settings?

**Allowed:** `teleport-snap` | `dash-slow-smooth-turn` | `continuous-smooth` | `station-none` | `vehicle-cockpit`

**Brief:** `locomotion.default`, `comfort.studioTier`

**Map:**

| Answer | Studio tier | Likely Store comfort (default) — confirm on [§5.1](https://developers.meta.com/horizon/policy/app-policies/) |
| --- | --- | --- |
| `teleport-snap` | A | Comfortable or Moderate — **justify** |
| `dash-slow-smooth-turn` | B | Moderate |
| `continuous-smooth` | C | Intense (or Moderate only with a written justification you will defend) |
| `station-none` / `vehicle-cockpit` | A if camera is not artificially accelerated | Comfortable if camera is fixed / strongly framed |

If `continuous-smooth` is the default, Q9 must **not** be Comfortable unless the user recants Q8.

---

## Q9 — Store comfort rating

**Ask:** Which Store comfort rating will you assign for the **default** experience? Comfortable / Moderate / Intense ([App policies §5.1](https://developers.meta.com/horizon/policy/app-policies/)).

**Allowed:** `comfortable` | `moderate` | `intense`

**Brief:** `comfort.storeRating`

**Why separate from Q8:** Studio tier ≠ Store label. Reviewers judge defaults.

---

## Q10 — Comfort settings

**Ask:** Will first-run settings expose snap vs smooth turn, vignette, and (if present) opt-in continuous loco?

**Allowed:** `yes-full` | `yes-turn-only` | `no`

**Brief:** `comfort.settings`

`no` fails this studio’s quality bar unless `locomotion.default` is `station-none` **and** there is no artificial camera motion. Re-ask if `no` + Tier B/C.

---

## Q11 — Multiplayer / social / UGC

**Ask:** Does any other person appear, persist content, or moderate the space? (Voice, avatars, text, world building, async ghosts.)

**Allowed:** `none` | `local-shared-guardian` | `online-sync` | `async-ugc` | `online-sync+ugc`

**Brief:** `social.mode`, `social.ugc`

If not `none`:

- Reporting from the **Meta button** is required for Store ([Content.3](https://developers.meta.com/horizon/resources/vrc-content-3/)) — add `social.reportFromMetaButton: true` or fail Store gate
- Hosted WebXR must name the netcode stack; Platform matchmaking implies native/PWA+Platform, not a raw Browser tab

---

## Q12 — IAP and paid app

**Ask:** Price of the title? Any in-app purchases or subscriptions?

**Allowed price:** `free` | `paid` | `undecided-price`  
**Allowed IAP:** `none` | `consumable` | `durable` | `subscription` | `mixed`

**Brief:** `commerce.price`, `commerce.iap`

**Conflicts:**

- Any IAP except `none` + `webxr-hosted` without later PWA → illegal for Store-style commerce; re-open Q1–Q2 ([App policies §1.1](https://developers.meta.com/horizon/policy/app-policies/))
- `subscription` + `webxr-pwa-store` → **TODO verify-on-fetch** [ps-iap](https://developers.meta.com/horizon/documentation/web/ps-iap/) (subscriptions documented as unsupported at last fetch). Treat as blocker until the live page says otherwise
- Paid/IAP + “thin utility / few videos” → [§4.3](https://developers.meta.com/horizon/policy/app-policies/) / [§4.5](https://developers.meta.com/horizon/policy/app-policies/) risk — demand a real loop in Q4

---

## Q13 — Ads

**Ask:** Will the app show ads?

**Allowed:** `no` | `yes-agreed-with-meta` | `yes-windows-into-service`

**Brief:** `commerce.ads`

Default `no`. `yes-*` requires policy exceptions and VRC Ads.1–7 (no immersive/head-tracked ads). Age group in Q14 may forbid ads regardless — **TODO verify-on-fetch** [age-groups](https://developers.meta.com/horizon/resources/age-groups/) “no ads” row.

---

## Q14 — Age group + IARC

**Ask:** Intended audience? Self-certify: Teens and Adults (13+) / Mixed Ages / Children (under 13). Any mature content (violence, language, nudity, substances)?

**Allowed ageGroup:** `teens-adults-13plus` | `mixed-ages` | `children-under-13`  
**Allowed mature:** `none` | `within-iarc` (describe)

**Brief:** `age.group`, `age.matureNotes`, `age.iarcPlanned`

**Conflicts:**

- `mixed-ages` requires Get Age Category API → **native or Platform-capable path**, not `webxr-hosted` ([age-groups](https://developers.meta.com/horizon/resources/age-groups/))
- All groups: no users **under 10** per that page — **TODO verify-on-fetch**
- IARC questionnaire must match Q4/Q11/Q12 ([Content.2](https://developers.meta.com/horizon/resources/vrc-content-2/))

---

## Q15 — Data inventory and privacy URL

**Ask:** What user data is collected or processed? Where will the privacy policy live? How does a user **anywhere** request deletion?

**Allowed collection (multi-select):** `none` | `account-id` | `analytics` | `crash` | `voice` | `camera-passthrough` | `hand-skeleton` | `friends` | `cloud-saves` | `other:<name>`

**Brief:** `privacy.collects[]`, `privacy.policyUrl`, `privacy.deletionPath`

`policyUrl` may be `TBD-owner-domain` but owner domain must be named. Deletion path cannot be `unspecified`. Friends/Platform data ⇒ DUC ([publish-data-use](https://developers.meta.com/horizon/resources/publish-data-use/)).

---

## Q16 — Permissions

**Ask:** Which device permissions will the APK or browser session request?

**Allowed (multi-select):** `none-beyond-internet` | `microphone` | `camera` | `hand-tracking` | `notifications` | `billing` | `storage` | `other:<android-or-web-name>`

**Brief:** `permissions.requested[]`, `permissions.denyBehavior` (`degrade` | `explain-and-block-feature`)

`denyBehavior` must not be `crash`. Each `other:` needs a justification for [Security.2](https://developers.meta.com/horizon/resources/vrc-quest-security-2/). **TODO verify-on-fetch** prohibited permission list before accepting `other:`.

---

## Q17 — Network

**Ask:** Does the **core loop** require Internet at runtime?

**Allowed:** `offline-ok` | `online-required` | `online-optional-features`

**Brief:** `network.core`

If `online-required`, plan an in-VR “connect to the Internet” state ([Functional.7](https://developers.meta.com/horizon/resources/vrc-quest-functional-7/) recommended). Cloud immersive streaming needs extra policy ([Streaming VRCs](https://developers.meta.com/horizon/resources/publish-quest-req/#streaming-requirements)).

---

## Q18 — Passthrough / MR Home

**Ask:** Can the app launch directly into passthrough? Will users enter from MR Home?

**Allowed:** `vr-only` | `passthrough-capable`

**Brief:** `platform.passthroughLaunch`

`passthrough-capable` ⇒ passthrough loading screens when coming from MR Home ([Functional.14](https://developers.meta.com/horizon/resources/vrc-quest-functional-14/)).

---

## Q19 — Store listing (if Q2 is not browser-only)

**Ask:** Working title (exact string for covers), one-line store description, and who owns hero/screenshot/trailer production?

**Allowed:** non-empty `title` (avoid redundant “VR” per [asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/)), non-empty short description, named `listing.assetOwner`

**Brief:** `identity.title`, `listing.shortDescription`, `listing.assetOwner`

If Q2 is `browser-only`, still collect `identity.title`; set `listing.horizonStoreAssets: n/a`.

Confirm they will produce the live Dashboard set (hero 10:3, covers, 5 screenshots, trailer 30s–2min) — **sizes: verify-on-fetch** [asset-guidelines](https://developers.meta.com/horizon/resources/asset-guidelines/).

---

## Q20 — Ambiguities sweep

**Ask:** Anything still fuzzy: save games vs App Sharing, entitlement check, localization, accessibility (one-hand, captions), analytics vendor, or “we’ll figure it out in the prototype”?

**Allowed:** a finite list of **named** follow-ups with owners **or** `none`

**Brief:** `ambiguities[]` (must be `[]` to pass the gate) plus any extra fields those follow-ups fill

Re-run any Q whose answer is still hedge language (“probably,” “maybe IAP”).

---

## Output

1. Write `studio/briefs/<appId>/app-brief.md` from the template (YAML front matter must satisfy the schema).
2. Optionally emit `app-brief.json` with the same fields (schema-valid).
3. Run store-gate checklists; set `storeGate` on the brief.
4. Only if `storeGate.result` is `pass` or `n/a-browser-only` **and** `ambiguities` is empty: generate code.

Do not attach legal advice. Point at Meta’s pages. Do not claim the title will be approved.
