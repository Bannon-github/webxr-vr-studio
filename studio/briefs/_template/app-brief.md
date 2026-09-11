# App brief — replace-with-app-id

Copy this folder to `studio/briefs/<appId>/`. Fill the YAML so it validates against [app-brief.schema.json](app-brief.schema.json). Source of answers: [app-interrogation.md](../../app-interrogation.md).

**Gate:** empty `ambiguities` + `storeGate.result` of `pass` or `n/a-browser-only` before any scaffold ([ADR 0006](../../adr/0006-store-gate-before-build.md)). A pass is not Meta approval.

```yaml
schemaVersion: 1
appId: replace-with-app-id

identity:
  title: ""
  oneLiner: "" # first five minutes, not a slogan
  genre: "" # action | adventure | puzzle | simulation | social | fitness | education | utility | experience | other:<word>
  owner: ""

platform:
  path: webxr-hosted # webxr-hosted | webxr-pwa-store | native-unity | native-unreal | native-other
  appType: immersive-vr # immersive-vr | panel-2d | mixed-reality-passthrough
  passthroughLaunch: vr-only # vr-only | passthrough-capable
  engineNotes: "Vite + Three.js per ADR 0001 if webxr-*; Unity/Unreal notes if native-*"

distribution:
  horizonStore: false
  laterPwa: false

hardware:
  gate: quest3
  also: [] # quest3s, quest2-soak

tracking:
  playModes: [sitting] # sitting, standing, roomscale — must match Store metadata if submitting
  defaultPlayMode: sitting

input:
  modes: [controllers] # controllers required for studio core loop; hands optional
  handsOptional: true

locomotion:
  default: teleport-snap # teleport-snap | dash-slow-smooth-turn | continuous-smooth | station-none | vehicle-cockpit

comfort:
  studioTier: A # A | B | C — ADR 0002
  storeRating: comfortable # comfortable | moderate | intense — App policies §5.1 default experience
  settings: yes-full # yes-full | yes-turn-only | no

social:
  mode: none # none | local-shared-guardian | online-sync | async-ugc | online-sync+ugc
  ugc: false
  reportFromMetaButton: false # required true when social.mode != none AND distribution.horizonStore

commerce:
  price: free # free | paid | undecided-price
  iap: none # none | consumable | durable | subscription | mixed
  ads: no # no | yes-agreed-with-meta | yes-windows-into-service

age:
  group: teens-adults-13plus # teens-adults-13plus | mixed-ages | children-under-13
  iarcPlanned: false # true required if horizonStore
  matureNotes: none

privacy:
  collects: [none] # none | account-id | analytics | crash | voice | camera-passthrough | hand-skeleton | friends | cloud-saves | other:<name>
  policyUrl: TBD-owner-domain
  deletionPath: "" # cannot be unspecified

permissions:
  requested: [none-beyond-internet]
  denyBehavior: degrade # degrade | explain-and-block-feature — never crash

network:
  core: offline-ok # offline-ok | online-required | online-optional-features

listing:
  horizonStoreAssets: n/a # planned | n/a
  shortDescription: ""
  assetOwner: ""

ambiguities: [] # MUST be empty to pass the gate

interrogation:
  completedThrough: 0 # 20 when stream finished
  log: []
  # - q: 1
  #   answer: webxr-hosted
  #   at: 2026-09-11T00:00:00Z

storeGate:
  ranOn: ""
  vrcPageFetched: "" # ISO date official VRC / policy pages were re-fetched
  result: not-run # pass | fail | n/a-browser-only | not-run
  openTodos: []
  blockerNotes: ""
```

## Conflicts to refuse (do not “fix” in prose)

Schema `allOf` also rejects these if you emit JSON:

- `platform.path: webxr-hosted` + IAP other than `none` without `distribution.laterPwa`
- `age.group: mixed-ages` + `platform.path: webxr-hosted` (needs Get Age Category / Platform SDK)
- `comfort.storeRating: comfortable` + `locomotion.default: continuous-smooth`
- `social.mode` not `none` + `horizonStore: true` + `reportFromMetaButton: false`
- `hardware.gate` anything but `quest3`
- `storeGate.result: fail` or `not-run` or non-empty `ambiguities` while generating an app

## After YAML

- [ ] Ran [requirements-pass.md](../../../docs/shipping/horizon-store/requirements-pass.md)
- [ ] Ran [disqualification-avoid.md](../../../docs/shipping/horizon-store/disqualification-avoid.md)
- [ ] Re-fetched Meta VRC / policy URLs; did not treat in-repo snapshots as current
- [ ] If `native-*`: no WebXR example scaffold; link Meta engine publish docs from `engineNotes`
