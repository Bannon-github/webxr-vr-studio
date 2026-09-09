# Studio playbook

How a productive WebXR VR app studio operates week to week.

## Cadence

| Ritual | When | Outcome |
| --- | --- | --- |
| Comfort review | Before merging loco/camera PRs | Tier classification + tester sign-off |
| Perf budget check | Mid-sprint + release | On-device ms vs target Hz |
| Matrix update | Every release candidate | docs/shipping table filled |
| ADR office hours | As needed | Decisions recorded in studio/adr |
| Content freeze | RC cut | Pipeline revision pinned |

## Roles (lightweight)

- **XR eng** — session, input, rendering integration
- **App eng** — product logic, networking, tooling
- **Design** — spatial UI, comfort, presence
- **QA** — emulator + headset matrix
- **Content** — assets through [content-pipeline.md](content-pipeline.md); interactive heroes follow [asset-to-interaction-workflow.md](asset-to-interaction-workflow.md)

## Branch / ship flow

1. Spike in examples/ or feature branch
2. Document user-facing comfort impact in PR template
3. Emulator smoke + at least one headset smoke for XR-touching PRs
4. Merge behind flag if locomotion or FOV changes
5. RC: soak + matrix + quality-bar.md gate
6. Tag release; update CHANGELOG.md

## Incident priorities

P0: crash on enter VR, stuck session, severe sickness default, security (HTTPS/permissions regression)
P1: input broken on primary device, frame pacing below tier device target
P2: visual polish, secondary device gaps

## Tooling defaults

- Vite for app shells
- Three.js unless ADR 0001 superseded
- GLB + KTX2 content path; behavior sidecar per [ADR 0004](adr/0004-asset-interaction-architecture.md)
- gh for PR / release notes
