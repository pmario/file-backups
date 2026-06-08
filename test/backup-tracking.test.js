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

// Milestone records carry label + description (for the summary).
let mLD = recordMilestone({},
	{ts: 5, size: 5, downloadId: 5, filename: "f", label: "v1.0", description: "first release"});
ok(mLD.milestones[0].label === "v1.0" && mLD.milestones[0].description === "first release",
	"milestone: label + description stored on the record");

// ---- getEffectiveLimit (phase 2) ----

const G = {
	defaultRemindMilestoneAfterDays: 7,
	defaultFileCountLimit: 30,
	defaultSizeLimitMB: 100
};

// null / absent override inherits the global default.
ok(getEffectiveLimit({remindAfterDays: null}, G, "remindAfterDays") === 7,
	"effective: null override inherits global");
ok(getEffectiveLimit({}, G, "fileCountLimit") === 30,
	"effective: absent override inherits global");
ok(getEffectiveLimit(undefined, G, "sizeLimitMB") === 100,
	"effective: undefined stash inherits global");

// A numeric override wins over the global.
ok(getEffectiveLimit({sizeLimitMB: 250}, G, "sizeLimitMB") === 250,
	"effective: numeric override wins");

// Override 0 is "explicitly off for this wiki" and MUST win over a non-zero
// global. This is the whole point of per-wiki overrides: opt one wiki out.
ok(getEffectiveLimit({remindAfterDays: 0}, G, "remindAfterDays") === 0,
	"effective: override 0 wins over non-zero global (per-wiki opt-out)");

// Global 0 (feature off globally) returns 0 when no override.
ok(getEffectiveLimit({}, {defaultFileCountLimit: 0}, "fileCountLimit") === 0,
	"effective: global 0 with no override returns 0");

// Adversarial: hostile override shapes fall through to the global, never throw.
ok(getEffectiveLimit({sizeLimitMB: "300"}, G, "sizeLimitMB") === 100,
	"effective: string override ignored, inherits global");
ok(getEffectiveLimit({sizeLimitMB: NaN}, G, "sizeLimitMB") === 100,
	"effective: NaN override ignored, inherits global");
ok(getEffectiveLimit({sizeLimitMB: -5}, G, "sizeLimitMB") === 100,
	"effective: negative override ignored, inherits global");
ok(getEffectiveLimit({sizeLimitMB: Infinity}, G, "sizeLimitMB") === 100,
	"effective: Infinity override ignored, inherits global");

// Adversarial: hostile global shapes fall through to 0, never throw.
ok(getEffectiveLimit({}, {defaultSizeLimitMB: "lots"}, "sizeLimitMB") === 0,
	"effective: non-number global falls back to 0");
ok(getEffectiveLimit({}, null, "sizeLimitMB") === 0,
	"effective: null globals falls back to 0");

// Unknown kind never throws; returns 0 (off).
ok(getEffectiveLimit({bogus: 5}, G, "bogus") === 0,
	"effective: unknown kind returns 0");

// ---- evaluateReminders + helpers (phase 3) ----

const DAY = 86400000;
const NOW = 1700000000000;

// All limits 0 (opt-in off) -> all null regardless of state.
eq(evaluateReminders(
	{rotation: {A: {size: 9e9}, B: {size: 9e9}}, milestones: [{size: 9e9}], lastMilestoneAt: 0},
	{}, {defaultRemindMilestoneAfterDays: 0, defaultFileCountLimit: 0, defaultSizeLimitMB: 0}, NOW
), {milestone: null, count: null, size: null}, "evaluate: all limits 0 -> silent");

// milestone-stale: fires past the window, quiet within it.
ok(evaluateReminders({lastMilestoneAt: NOW - 20 * DAY}, {}, {defaultRemindMilestoneAfterDays: 14}, NOW).milestone === 14,
	"evaluate: milestone stale fires past the window");
ok(evaluateReminders({lastMilestoneAt: NOW - 5 * DAY}, {}, {defaultRemindMilestoneAfterDays: 14}, NOW).milestone === null,
	"evaluate: milestone not stale within the window");

// file-count: fires over limit, quiet at/under.
ok(evaluateReminders({rotation: {A: {}, B: {}, C: {}}}, {}, {defaultFileCountLimit: 2}, NOW).count === 2,
	"evaluate: file-count fires when over limit");
ok(evaluateReminders({rotation: {A: {}, B: {}, C: {}}}, {}, {defaultFileCountLimit: 5}, NOW).count === null,
	"evaluate: file-count quiet at/under limit");

// total-size: fires when summed bytes exceed limit*MB.
ok(evaluateReminders({rotation: {A: {size: 2 * 1024 * 1024}}}, {}, {defaultSizeLimitMB: 1}, NOW).size === 1,
	"evaluate: size fires when over limit");
ok(evaluateReminders({rotation: {A: {size: 512 * 1024}}}, {}, {defaultSizeLimitMB: 1}, NOW).size === null,
	"evaluate: size quiet under limit");

// per-wiki override wins: a higher override suppresses a global that would fire;
// override 0 turns the reminder off for this wiki even when the global is on.
ok(evaluateReminders({rotation: {A: {}, B: {}, C: {}}}, {fileCountLimit: 10}, {defaultFileCountLimit: 2}, NOW).count === null,
	"evaluate: per-wiki override (10) suppresses global (2)");
ok(evaluateReminders({rotation: {A: {}, B: {}, C: {}}}, {fileCountLimit: 0}, {defaultFileCountLimit: 2}, NOW).count === null,
	"evaluate: per-wiki override 0 turns the reminder off");

// snooze: future snooze suppresses, expired snooze lets it fire.
ok(evaluateReminders({lastMilestoneAt: 0, snoozedUntil: {milestone: NOW + DAY}}, {}, {defaultRemindMilestoneAfterDays: 14}, NOW).milestone === null,
	"evaluate: future snooze suppresses the reminder");
ok(evaluateReminders({lastMilestoneAt: 0, snoozedUntil: {milestone: NOW - DAY}}, {}, {defaultRemindMilestoneAfterDays: 14}, NOW).milestone === 14,
	"evaluate: expired snooze lets the reminder fire");

// Adversarial: hostile stash shapes never throw; counts/sizes degrade to 0.
let evG;
try { evG = evaluateReminders(null, {}, {defaultFileCountLimit: 1, defaultSizeLimitMB: 1}, NOW); } catch (e) { evG = "threw:" + e.message; }
ok(typeof evG === "object" && evG.count === null && evG.size === null,
	"evaluate: null stash does not throw and yields no reminders");

ok(reminderFileCount({rotation: {A: {}, B: {}, C: {}}, milestones: [{}, {}]}) === 5,
	"reminderFileCount: rotation slots + milestones");
ok(reminderFileCount({rotation: "garbage", milestones: "nope"}) === 0,
	"reminderFileCount: hostile shapes -> 0");
ok(reminderTotalSize({rotation: {A: {size: 100}, B: {size: 50}}, milestones: [{size: 25}]}) === 175,
	"reminderTotalSize: sums rotation + milestone sizes");
ok(reminderTotalSize({rotation: {A: {size: "big"}, B: {}}, milestones: [{size: NaN}]}) === 0,
	"reminderTotalSize: non-numeric sizes ignored");
ok(reminderFileCount({rotation: {A: {}, B: {missing: true}}, milestones: [{}, {missing: true}]}) === 2,
	"reminderFileCount: missing entries are not counted");
ok(reminderTotalSize({rotation: {A: {size: 100}, B: {size: 50, missing: true}}, milestones: [{size: 25, missing: true}]}) === 100,
	"reminderTotalSize: missing entries are not summed");

// ---- findBackupByFile ----
// Pure string matching — it never touches the filesystem — so all inputs are
// SYNTHETIC and PORTABLE: no real or absolute file paths are hardcoded. The
// "open" (absolute) path is built by prefixing an arbitrary download root onto
// the stored (relative) filename, which is exactly the relationship the matcher
// relies on. tnorm mirrors contentScript's fbNorm (lowercase, strip file://,
// unify slashes, drop leading slash); stored filenames use OS (backslash)
// separators because background.js builds them with path.join on Windows.
function tnorm(s) { return String(s).toLowerCase().replace(/^file:\/+/, "").replace(/\\/g, "/").replace(/^\/+/, ""); }

let relMile = "backups\\notes.html\\notes(SNAP-A).html";
let relRot = "backups\\notes.html\\notes(A).html";
let mStashes = {
	"WIKI_MAIN_1": {
		milestones: [{ts: 111, filename: relMile, label: "v1"}],
		rotation: {A: {ts: 50, filename: relRot}}
	},
	"WIKI_MAIN_2": {milestones: [{ts: 1, filename: "backups\\other.html\\other(SNAP).html"}]}
};

// Open path = arbitrary root + the stored relative filename (separators unified).
let mFound = findBackupByFile(mStashes, tnorm("any/download/root/" + relMile.replace(/\\/g, "/")), tnorm);
ok(mFound && mFound.kind === "milestone" && mFound.mainWikiPath === "WIKI_MAIN_1", "findBackup: an open milestone file -> {milestone, main wiki}");
ok(mFound && mFound.entry && mFound.entry.label === "v1", "findBackup: returns the matched milestone entry");

let rFound = findBackupByFile(mStashes, tnorm("any/download/root/" + relRot.replace(/\\/g, "/")), tnorm);
ok(rFound && rFound.kind === "rotation" && rFound.mainWikiPath === "WIKI_MAIN_1", "findBackup: an open rotation file -> {rotation, main wiki}");
ok(rFound && rFound.entry && rFound.entry.slot === "A", "findBackup: rotation entry carries its slot letter");

ok(findBackupByFile(mStashes, tnorm("any/root/notes.html"), tnorm) === null,
	"findBackup: the main wiki file itself is not a backup");
ok(findBackupByFile(mStashes, tnorm("any/root/unknown.html"), tnorm) === null,
	"findBackup: an untracked file yields null");
ok(findBackupByFile({K: {milestones: [{ts: 1, filename: "notes.html"}]}}, tnorm("root/x-notes.html"), tnorm) === null,
	"findBackup: a non-boundary path suffix does not false-match");
ok(findBackupByFile(null, "x", tnorm) === null, "findBackup: null stashes -> null");
ok(findBackupByFile({K: {milestones: "nope", rotation: "nope"}}, "x", tnorm) === null, "findBackup: hostile shapes -> null (no throw)");
ok(findBackupByFile(mStashes, "", tnorm) === null, "findBackup: empty current path -> null");

// ---- parseIndexFormat ----
let idx = "300: /x/\n200: filename content-length last-modified file-type\n201: notes(A).html 100 1717869413 FILE\n201: notes%282026%29.html 250 1717869000 FILE\n201: sub 0 1 DIRECTORY\n";
let pf = parseIndexFormat(idx);
ok(pf.length === 2, "parseIndexFormat: only FILE entries (directory skipped)");
ok(pf[0].name === "notes(A).html" && pf[0].size === 100, "parseIndexFormat: name + size of first file");
ok(pf[1].name === "notes(2026).html" && pf[1].size === 250, "parseIndexFormat: URL-decoded name");
ok(parseIndexFormat("").length === 0 && parseIndexFormat(null).length === 0, "parseIndexFormat: empty/null -> []");

// ---- syncScannedFiles ----
let scanStash = {
	rotation: {
		A: {filename: "sub/twBackups/notes.html/notes(A).html", size: 100},
		B: {filename: "sub/twBackups/notes.html/notes(B).html", size: 90}
	},
	milestones: [{filename: "sub/twBackups/notes.html/notes(2026).html", size: 250, label: "v1"}]
};
let scanFiles = [
	{name: "notes(A).html", size: 100},     // matches rotation A
	{name: "notes(2026).html", size: 250},  // matches the milestone
	{name: "extra-old(C).html", size: 500}  // not tracked -> discovered ; B's file absent -> missing
];
let sres = syncScannedFiles(scanStash, scanFiles);
ok(sres.tracked === 2 && sres.missing === 1 && sres.discovered === 1,
	"syncScannedFiles: counts {tracked:2, missing:1, discovered:1}");
ok(scanStash.rotation.A.missing === false && scanStash.rotation.B.missing === true,
	"syncScannedFiles: present/missing flags set on rotation");
ok(scanStash.milestones[0].missing === false, "syncScannedFiles: present flag set on milestone");
ok(scanStash.discovered.length === 1 && scanStash.discovered[0].name === "extra-old(C).html" && scanStash.discovered[0].source === "scan",
	"syncScannedFiles: unmatched folder file recorded as discovered, marked source:scan");
ok(syncScannedFiles(null, []).discovered === 0, "syncScannedFiles: null stash -> zero counts (no throw)");

console.log("done");
