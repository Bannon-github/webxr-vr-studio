# App briefs

Filled product briefs live in `studio/briefs/<appId>/`. Start from [`_template/`](_template/).

- Interrogation stream: [`../app-interrogation.md`](../app-interrogation.md)
- Schema: [`_template/app-brief.schema.json`](_template/app-brief.schema.json)
- Gate: [`../../docs/shipping/horizon-store/`](../../docs/shipping/horizon-store/) + [ADR 0006](../adr/0006-store-gate-before-build.md)

Do not commit secrets (Dashboard secrets, keystore passwords, entitlement tokens) in a brief. `privacy.policyUrl` may be public; deletion-process emails are fine; API keys are not.
