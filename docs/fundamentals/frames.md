# Frames and rendering

## Animation loop

Use session.requestAnimationFrame(callback), not the window rAF, while immersive. The callback receives (time, frame) where frame is an XRFrame tied to that session.

Typical body:

1. session.requestAnimationFrame(onFrame) — re-schedule first
2. pose = frame.getViewerPose(refSpace); if !pose return
3. gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer)
4. For each view in pose.views: set viewport from baseLayer.getViewport(view); set projection/view matrices; draw
5. Optionally poll gamepads / inputSources for continuous axes

## XRWebGLLayer

Legacy/simple path: new XRWebGLLayer(session, gl) then updateRenderState({ baseLayer }). The compositor owns presentation; you render into the layer framebuffer each frame.

Ensure the WebGL context is created with xrCompatible: true (or makeXRCompatible()).

## Stereo views

Each XRView represents one eye (or primary view). Always render every view the pose provides. Viewport rectangles pack left/right (or more) into the eye buffer.

## Timing

Aim to finish GPU work within the headset frame budget (e.g. ~11.1 ms at 90 Hz, ~13.9 ms at 72 Hz). See docs/performance/.

Refs: MDN Rendering and the WebXR frame animation callback; Immersive Web explainer.
