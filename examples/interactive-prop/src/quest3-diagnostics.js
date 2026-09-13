/**
 * Toggleable Quest 3 session / frame overlay.
 * Steady state with the overlay off: one boolean check per rAF (no sample, no DOM).
 * When on: write into a preallocated Float32Array; paint DOM at ~4 Hz.
 * Never invent supportedFrameRates / session.frameRate / FFR.
 */

const RING = 90;
const PAINT_MS = 250;
const _ms = new Float32Array(RING);

const sessionSnap = {
  supportedText: "n/a",
  requestedText: "n/a",
  appliedOk: false,
  frameRateText: "n/a",
  ffrSet: null,
  presenting: false,
};

let enabled = false;
let write = 0;
let filled = 0;
let lastNow = 0;
let lastPaint = 0;
let panel = null;
let els = null;
let renderer = null;
let getToolbox = () => null;

export function initQuest3Diagnostics(opts) {
  panel = opts.panel;
  renderer = opts.renderer;
  getToolbox = opts.getToolbox;
  els = {
    rates: opts.panel.querySelector("[data-q3=rates]"),
    ffr: opts.panel.querySelector("[data-q3=ffr]"),
    frame: opts.panel.querySelector("[data-q3=frame]"),
    budget: opts.panel.querySelector("[data-q3=budget]"),
    note: opts.panel.querySelector("[data-q3=note]"),
  };
  setQuest3DiagnosticsEnabled(false);
  paintBudgetOnce();
}

export function isQuest3DiagnosticsEnabled() {
  return enabled;
}

export function setQuest3DiagnosticsEnabled(on) {
  enabled = Boolean(on);
  if (panel) panel.hidden = !enabled;
  if (!enabled) {
    write = 0;
    filled = 0;
    lastNow = 0;
    lastPaint = 0;
    return;
  }
  lastNow = 0;
  lastPaint = 0;
  paintNow();
}

export function toggleQuest3Diagnostics() {
  setQuest3DiagnosticsEnabled(!enabled);
  return enabled;
}

/** Call from sessionstart only (may allocate). */
export function recordQuest3Session(session, requestedHz, appliedOk) {
  sessionSnap.presenting = Boolean(session);
  if (session?.supportedFrameRates && session.supportedFrameRates.length) {
    sessionSnap.supportedText = joinRates(session.supportedFrameRates);
  } else {
    sessionSnap.supportedText = "n/a";
  }
  sessionSnap.requestedText = requestedHz == null ? "n/a" : String(requestedHz);
  sessionSnap.appliedOk = Boolean(appliedOk);
  sessionSnap.frameRateText = formatSessionFrameRate(session);
}

export function recordQuest3FfrSet(value) {
  sessionSnap.ffrSet = typeof value === "number" ? value : null;
}

export function recordQuest3SessionEnd() {
  sessionSnap.presenting = false;
}

/** XR animation loop: no-op when overlay is off. */
export function sampleQuest3Diagnostics(nowMs) {
  if (!enabled) return;
  if (lastNow > 0) {
    const dt = nowMs - lastNow;
    if (dt > 0 && dt < 250) {
      _ms[write] = dt;
      write += 1;
      if (write === RING) write = 0;
      if (filled < RING) filled += 1;
    }
  }
  lastNow = nowMs;
  if (nowMs - lastPaint >= PAINT_MS) {
    lastPaint = nowMs;
    paintNow();
  }
}

function joinRates(list) {
  let s = "";
  for (let i = 0; i < list.length; i++) {
    if (i) s += ", ";
    s += list[i];
  }
  return s.length ? s : "n/a";
}

function formatSessionFrameRate(session) {
  const hz = session?.frameRate;
  return typeof hz === "number" && hz > 0 ? String(hz) : "n/a";
}

function meanMs() {
  if (!filled) return 0;
  let sum = 0;
  for (let i = 0; i < filled; i++) sum += _ms[i];
  return sum / filled;
}

function ffrText() {
  const xr = renderer?.xr;
  if (xr && typeof xr.getFoveation === "function") {
    const v = xr.getFoveation();
    if (typeof v === "number") return String(v);
  }
  if (sessionSnap.ffrSet != null) return String(sessionSnap.ffrSet) + " (set)";
  return "n/a";
}

function paintBudgetOnce() {
  if (!els?.budget) return;
  const lod = getToolbox()?.userData?.lod;
  const s0 = lod?.stats?.[0];
  const s1 = lod?.stats?.[1];
  const s2 = lod?.stats?.[2];
  const l2 = getToolbox()?.userData?.l2;
  const pack = getToolbox()?.userData?.packaging;
  const tex = l2
    ? l2.lodAlbedoSize
      ? `${l2.textureSize}² LOD0 ${l2.maps} · ${l2.lodAlbedoSize}² LOD1 ${l2.lodMaterialClass?.[1] ?? "albedo"} / LOD2 color-only ${l2.lodMaterialClass?.[2] ?? "MeshBasic"} ×${l2.uniqueTextures} (authoring est.)`
      : `${l2.textureSize}² ${l2.maps} ×${l2.uniqueTextures} (authoring est.)`
    : "tex ≤1024²";
  const src = pack?.source ? ` · visual ${pack.source}` : "";
  const line = s0
    ? `LOD0 ${s0.tris} tris / ${s0.draws} draws · LOD1 ${s1.tris}/${s1.draws} · LOD2 ${s2.tris}/${s2.draws} · fastener +12/1 · ${tex}${src}`
    : "LOD stats unavailable";
  els.budget.textContent = line;
}

function paintNow() {
  if (!els) return;
  const session = renderer?.xr?.getSession?.() ?? null;
  if (session) sessionSnap.frameRateText = formatSessionFrameRate(session);

  const req = sessionSnap.requestedText;
  const applied = req === "n/a" ? "" : sessionSnap.appliedOk ? " (update ok)" : " (pending / rejected / skipped)";
  els.rates.textContent =
    `supported ${sessionSnap.supportedText} · requested ${req}${applied} · session.frameRate ${sessionSnap.frameRateText}`;
  els.ffr.textContent = ffrText();

  if (!filled) {
    els.frame.textContent = "— (need a few rAF samples)";
  } else {
    const avg = meanMs();
    els.frame.textContent = `${avg.toFixed(2)} ms mean rAF Δ (${filled} samples) — not compositor / not a headset official`;
  }

  if (els.note) {
    els.note.textContent = sessionSnap.presenting
      ? "XR session active. DOM overlay may be hidden in immersive-vr; values persist after exit."
      : "No XR session — frame-rate APIs skipped (desktop). Do not treat rAF Δ as Quest 3 ms.";
  }
}
