# Reference spaces

Call session.requestReferenceSpace(type). Resolves to XRReferenceSpace or XRBoundedReferenceSpace.

## Types (MDN)

| Type | Role |
| --- | --- |
| viewer | Origin tracks the viewer. Always available. Useful for offsets and inline. |
| local | Origin near viewer at session start; tracking optimized for staying near start. |
| local-floor | Like local, but Y origin at estimated floor; good default for room-scale seated/standing. |
| bounded-floor | Floor-relative with boundsGeometry (play area polygon) when the runtime provides it. |
| unbounded | Large-area freedom; origin may drift for stability around the user. |

## Studio defaults

- Prefer local-floor when optionalFeatures allows it; fall back to local, then viewer.
- Do not assume floor height is exact — offer a recalibrate / recentre affordance.
- For teleport locomotion, keep a stable stage space and apply a player offset (see ADR 0002).
- getViewerPose / getPose may return null when tracking is lost — skip the frame draw or show a recovery UI; never crash.

## Poses

- frame.getViewerPose(refSpace) → XRViewerPose with views[] (each has projectionMatrix and transform)
- frame.getPose(space, baseSpace) → XRPose for controllers, anchors, offsets

Refs: MDN XRSession.requestReferenceSpace; Immersive Web Spatial Tracking.
