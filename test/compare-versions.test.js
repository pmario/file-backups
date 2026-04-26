"use strict";
require("../addon/libs/compare-versions.js");
const assert = require("assert");

function eq(actual, expected, label) {
	try {
		assert.strictEqual(actual, expected);
		console.log("OK   " + label);
	} catch (e) {
		console.log("FAIL " + label);
		console.log("  actual:   " + JSON.stringify(actual));
		console.log("  expected: " + JSON.stringify(expected));
		process.exitCode = 1;
	}
}

function eqJson(actual, expected, label) {
	eq(JSON.stringify(actual), JSON.stringify(expected), label);
}

// === compareVersions ====================================================

// Sanity checks (one of each path).
eq(compareVersions("0.9.0", "0.9.0"), 0, "equal");
eq(compareVersions("0.10.0", "0.9.0"), 1, "minor parsed numerically — '10' > '9' (string sort would fail)");
eq(compareVersions("1.0.0", "0.99.99"), 1, "major dominates");

// Stable (3 seg) vs beta (4 seg) at the same x.y.z.
// Per the convention: missing 4th = 0, so 0.9.0 === 0.9.0.0 < 0.9.0.1.
// The beta comes AFTER the matching stable (and the next stable patch
// 0.9.1 is higher again).
eq(compareVersions("0.9.0", "0.9.0.1"), -1, "stable < first beta of same x.y.z (4th=0 vs 4th=1)");
eq(compareVersions("0.9.0.1", "0.9.0"), 1, "beta > matching stable (antisymmetric)");
eq(compareVersions("0.9.0.5", "0.9.0.1"), 1, "later beta > earlier beta");
eq(compareVersions("0.9.1", "0.9.0.99"), 1, "next stable patch beats all betas of prior patch");

// Missing segments treated as 0.
eq(compareVersions("0.9.0", "0.9.0.0"), 0, "missing 4th == 0");
eq(compareVersions("1", "1.0.0"), 0, "1 == 1.0.0");
eq(compareVersions("1.2", "1.2.0.0"), 0, "1.2 == 1.2.0.0");

// Defensive — malformed inputs shouldn't crash; sort as lowest.
eq(compareVersions("", "0.9.0"), -1, "empty < anything");
eq(compareVersions(null, "0.9.0"), -1, "null < anything");
eq(compareVersions(undefined, undefined), 0, "undefined == undefined");
eq(compareVersions(" 0.9.0 ", "0.9.0"), 0, "whitespace tolerated");
eq(compareVersions("abc", "0.9.0"), -1, "non-numeric segments coerce to 0 → less");
eq(compareVersions("1.x.0", "1.0.0"), 0, "non-numeric mid-segment coerced to 0");

// Antisymmetry: cmp(a,b) === -cmp(b,a) for all (a,b).
function antisym(a, b, label) {
	var ab = compareVersions(a, b);
	var ba = compareVersions(b, a);
	if (ab + ba !== 0) {
		console.log("FAIL antisymmetric: " + label + "  cmp(a,b)=" + ab + " cmp(b,a)=" + ba);
		process.exitCode = 1;
	} else {
		console.log("OK   antisymmetric: " + label);
	}
}
antisym("0.9.0", "0.9.0.1", "stable vs beta");
antisym("0.10.0", "0.9.99.99", "minor bump vs deep beta");
antisym("", "0.9.0", "empty vs version");

// Sort integration — exercises numeric precedence across stable + beta + patch boundaries.
var shuffled = ["0.10.0", "0.9.0", "0.10.0.5", "0.9.0.1", "0.9.1", "0.10.0.1"];
var expected = ["0.9.0", "0.9.0.1", "0.9.1", "0.10.0", "0.10.0.1", "0.10.0.5"];
eqJson(shuffled.slice().sort(compareVersions), expected, "Array.sort produces full ordering across stable + beta + patch");

// Return-type contract — callers do `> 0` / `< 0`, breaks if returns boolean.
eq(typeof compareVersions("1.0.0", "0.9.0"), "number", "returns number, not boolean");

// === parseVersion ======================================================

eq(parseVersion("0.9.0").isBeta, false, "3 segments → not beta");
eq(parseVersion("0.9.0.1").isBeta, true, "4 segments → beta");
eq(parseVersion("0.9.0.0").isBeta, true, "4 segments with 4th=0 still counts as beta (rare)");
eq(parseVersion("1.0").isBeta, false, "2 segments → not beta");
eq(parseVersion("1").isBeta, false, "1 segment → not beta");
eq(parseVersion("0.9.0.0.0").isBeta, false, "5 segments → not beta (only 4 is the convention)");
eq(parseVersion("").isBeta, false, "empty → not beta");
eq(parseVersion(null).isBeta, false, "null → not beta");
eq(parseVersion(undefined).isBeta, false, "undefined → not beta");

eqJson(parseVersion("0.9.0.5").segments, [0, 9, 0, 5], "segments parsed as numbers");
eqJson(parseVersion("0.9.0").segments, [0, 9, 0], "3 segments");
eqJson(parseVersion("").segments, [], "empty has no segments");
eqJson(parseVersion(null).segments, [], "null has no segments");
eqJson(parseVersion(" 0.9.0 ").segments, [0, 9, 0], "whitespace trimmed");

console.log("done");
