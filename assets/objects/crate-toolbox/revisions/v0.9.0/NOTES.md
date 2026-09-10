# crate-toolbox v0.9.0

Shipping/input-parity UPGRADE on the same `objectId`. Not a new layer. No GLB in this folder.

- Runtime (`examples/interactive-prop`): when presenting, if no controller ray hit this frame, drive hover from an active hand — index-finger-tip `nearestColliderTo`, then `rayFromController(hand)` / `firstHit`. Same `setHover` / `hoverEnter` as controllers (`inputSource` null).
- Pinch path unchanged (use / grab / drive). Hover does not fire those intents.
- Controllers win when they have a hit. Shared pick list from v0.8; no per-frame `new` when `P` is off.
- Confirm on headset: [quest-3-on-device-qa](../../../../docs/shipping/quest-3-on-device-qa.md) Hands subsection. Qualitative only.
- LOD draws and texture caps unchanged (14/8/2 + fastener 1; pref 512 / max 1024).
- Quest 3 frame time / FFR still **unmeasured**.
