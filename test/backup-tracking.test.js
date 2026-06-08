"use strict";
require("../addon/libs/backup-tracking.js");
const assert = require("assert");

function eq(actual, expected, label) {
	try {
		assert.deepStrictEqual(actual, expected);
		console.log("OK   " + label);
	} catch (e) {
		console.log("FAIL " + label);
		console.log("  actual:   " + JSON.stringify(actual));
		console.log("  expected: " + JSON.stringify(expected));
		process.exitCode = 1;
	}
}

function ok(cond, label) {
	if (cond) {
		console.log("OK   " + label);
	} else {
		console.log("FAIL " + label);
		process.exitCode = 1;
	}
}

// ---- recordRotationSlot ----

// Smoke. Existing top-level fields preserved; the slot lands.
let s = recordRotationSlot({counter: 5, subdir: "wikis"}, "A",
	{ts: 1, size: 2, downloadId: 3, filename: "x"});
ok(s.counter === 5 && s.subdir === "wikis", "smoke: existing fields preserved");
eq(s.rotation.A, {ts: 1, size: 2, downloadId: 3, filename: "x"}, "smoke: slot recorded");

// Re-recording the same slot overwrites prior data (live data per phase 1 spec).
let s2 = recordRotationSlot(s, "A",
	{ts: 99, size: 98, downloadId: 97, filename: "y"});
ok(s2.rotation.A.ts === 99 && s2.rotation.A.downloadId === 97,
	"slot rewrite overwrites prior record");

// Adversarial: mutating the OUTPUT's preserved slot must not change the INPUT.
// A pure helper must not share nested references between input and output.
let inA = {rotation: {B: {ts: 100, size: 200, downloadId: 300, filename: "old"}}};
let outA = recordRotationSlot(inA, "C",
	{ts: 999, size: 998, downloadId: 997, filename: "new"});
outA.rotation.B.size = 1;
ok(inA.rotation.B.size === 200,
	"rotation: mutating output's preserved slot does not affect input");

// Adversarial: extra keys on meta must not leak into storage. The schema
// is closed; callers can pass arbitrary objects without polluting state.
let outE = recordRotationSlot({}, "A",
	{ts: 1, size: 2, downloadId: 3, filename: "x", evil: "hax"});
ok(!("evil" in outE.rotation.A),
	"rotation: extra meta keys are stripped");

// Regression net: a future caller might write an unexpected shape into
// stash.rotation. The helper must not propagate that into output and must
// still record the new slot.
let outG = recordRotationSlot({rotation: "garbage"}, "A",
	{ts: 1, size: 2, downloadId: 3, filename: "x"});
ok(typeof outG.rotation === "object" && !Array.isArray(outG.rotation) && outG.rotation !== null,
	"rotation: non-object prior rotation does not pollute output");
ok(outG.rotation.A && outG.rotation.A.ts === 1,
	"rotation: slot still recorded when prior rotation was garbage");

// ---- recordMilestone ----

// Smoke.
let m = recordMilestone({counter: 1}, {ts: 1000, size: 100, downloadId: 5, filename: "f"});
ok(m.counter === 1, "milestone smoke: existing fields preserved");
ok(m.milestones.length === 1 && m.lastMilestoneAt === 1000,
	"milestone smoke: appended and lastMilestoneAt set");

// Adversarial: mutating an output milestone entry must not affect the input.
let inB = {milestones: [{ts: 1, size: 1, downloadId: 1, filename: "a"}]};
let outB = recordMilestone(inB, {ts: 2, size: 2, downloadId: 2, filename: "b"});
outB.milestones[0].size = 999;
ok(inB.milestones[0].size === 1,
	"milestone: mutating output entry does not affect input entry");

// Adversarial: lastMilestoneAt must not REGRESS when an older-ts milestone arrives.
// Multi-tab clock skew or out-of-order recording must not poison the stale-reminder
// trigger by setting lastMilestoneAt to an earlier value than what we already had.
let mA = recordMilestone({}, {ts: 1000, size: 1, downloadId: 1, filename: "a"});
let mB = recordMilestone(mA, {ts: 500, size: 1, downloadId: 2, filename: "b"});
ok(mB.lastMilestoneAt >= mA.lastMilestoneAt,
	"milestone: lastMilestoneAt does not regress on older-ts append");

// Regression net: a future caller might write an unexpected shape into
// stash.milestones. The helper must not throw, and the result must remain
// a usable array.
let outC;
try {
	outC = recordMilestone({milestones: "notAnArray"},
		{ts: 1, size: 1, downloadId: 1, filename: "x"});
} catch (e) {
	outC = "threw: " + e.message;
}
ok(typeof outC === "object" && Array.isArray(outC.milestones),
	"milestone: non-array prior milestones does not throw and result is an array");
ok(outC.milestones && outC.milestones.length === 1 && outC.milestones[0].downloadId === 1,
	"milestone: new entry survives when prior milestones was garbage");

// Adversarial: extra keys on meta must not leak.
let outF = recordMilestone({},
	{ts: 1, size: 1, downloadId: 1, filename: "x", evil: "hax"});
ok(!("evil" in outF.milestones[0]),
	"milestone: extra meta keys are stripped");

console.log("done");
