import assert from "node:assert/strict";
import { test } from "node:test";
import {
  forceReleaseHold,
  isHoldPoseLost,
  releaseIfSourceRemoved,
  releaseLostHold,
} from "./hold-tracking.js";

function slot(held, inputSource = null) {
  return { userData: { held, pinching: Boolean(held), inputSource } };
}

function prop(holder) {
  return { name: "toolbox", userData: { heldBy: holder || true } };
}

function endGrabStub(object) {
  object.userData.heldBy = null;
}

test("missing inputSource is a lost hold", () => {
  assert.equal(isHoldPoseLost({}, {}, null, { visible: true }), true);
});

test("null grip pose is lost", () => {
  const src = { gripSpace: {} };
  const frame = { getPose: () => null };
  assert.equal(isHoldPoseLost(frame, {}, src, { visible: true }), true);
});

test("live grip pose is not lost (even if Three visible is stale)", () => {
  const src = { gripSpace: {} };
  const frame = { getPose: () => ({}) };
  assert.equal(isHoldPoseLost(frame, {}, src, { visible: false }), false);
});

test("null targetRay pose is lost when gripSpace is absent", () => {
  const src = { targetRaySpace: {} };
  const frame = { getPose: () => null };
  assert.equal(isHoldPoseLost(frame, {}, src, { visible: true }), true);
});

test("null wrist joint pose is lost", () => {
  const wrist = {};
  const src = { hand: { get: (name) => (name === "wrist" ? wrist : undefined) } };
  const frame = { getJointPose: () => null };
  assert.equal(isHoldPoseLost(frame, {}, src, { visible: true }), true);
});

test("live wrist joint pose is not lost", () => {
  const wrist = {};
  const src = { hand: { get: () => wrist } };
  const frame = { getJointPose: () => ({}) };
  assert.equal(isHoldPoseLost(frame, {}, src, { visible: false }), false);
});

test("missing wrist joint is lost", () => {
  const src = { hand: { get: () => undefined } };
  assert.equal(isHoldPoseLost({}, {}, src, { visible: true }), true);
});

test("wrist getPose fallback when getJointPose is absent", () => {
  const wrist = {};
  const src = { hand: { get: () => wrist } };
  const frame = { getPose: () => null };
  assert.equal(isHoldPoseLost(frame, {}, src, { visible: true }), true);
});

test("no queryable space uses holder.visible", () => {
  const src = {};
  assert.equal(isHoldPoseLost({}, {}, src, { visible: false }), true);
  assert.equal(isHoldPoseLost({}, {}, src, { visible: true }), false);
  assert.equal(isHoldPoseLost({}, {}, src, null), true);
});

test("forceReleaseHold calls endGrab and clears held / heldBy / pinching", () => {
  const object = prop({});
  const input = slot(object);
  assert.equal(forceReleaseHold(input, endGrabStub, {}, null), true);
  assert.equal(input.userData.held, null);
  assert.equal(input.userData.pinching, false);
  assert.equal(object.userData.heldBy, null);
  assert.equal(forceReleaseHold(input, endGrabStub, {}, null), false);
});

test("releaseLostHold uses the same endGrab path on a null pose", () => {
  const object = prop({});
  const src = { gripSpace: {} };
  const input = slot(object, src);
  const lost = { getPose: () => null };
  assert.equal(releaseLostHold(input, lost, {}, src, { visible: true }, endGrabStub, {}, null), true);
  assert.equal(input.userData.held, null);
  assert.equal(object.userData.heldBy, null);
});

test("releaseLostHold is a no-op while the pose is live", () => {
  const holder = {};
  const object = prop(holder);
  const src = { gripSpace: {} };
  const input = slot(object, src);
  const live = { getPose: () => ({}) };
  assert.equal(releaseLostHold(input, live, {}, src, { visible: true }, endGrabStub, {}, null), false);
  assert.equal(input.userData.held, object);
  assert.equal(object.userData.heldBy, holder);
});

test("releaseIfSourceRemoved fires when the holding source is in removed[]", () => {
  const object = prop({});
  const src = { gripSpace: {} };
  const input = slot(object, src);
  assert.equal(releaseIfSourceRemoved(input, [src], endGrabStub, {}, null), true);
  assert.equal(input.userData.held, null);
  assert.equal(object.userData.heldBy, null);
});

test("releaseIfSourceRemoved ignores an unrelated removed source", () => {
  const object = prop({});
  const src = { gripSpace: {} };
  const input = slot(object, src);
  assert.equal(releaseIfSourceRemoved(input, [{}], endGrabStub, {}, null), false);
  assert.equal(input.userData.held, object);
});

test("releaseIfSourceRemoved fires when the holding source pointer is already gone", () => {
  const object = prop({});
  const input = slot(object, null);
  assert.equal(releaseIfSourceRemoved(input, [], endGrabStub, {}, null), true);
  assert.equal(input.userData.held, null);
});
