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

// One sanity check per code path. The breakage tests below exercise corners.
eq(compareVersions("0.9.0", "0.9.0"), 0, "equal");
eq(compareVersions("0.10.0", "0.9.0"), 1, "minor parsed numerically — '10' > '9' is the bug a string-sort would hit");
eq(compareVersions("0.10.0", "0.10.0-beta.1"), 1, "release > prerelease at same x.y.z");
eq(compareVersions("0.10.0-beta.10", "0.10.0-beta.9"), 1, "numeric prerelease id parsed numerically");
eq(compareVersions("0.10.0-beta.1", "0.10.0-alpha.5"), 1, "alpha < beta lex on alphanumeric ids");

// --- Build metadata MUST be ignored per semver.org §10 ---
// Two versions that differ only in build metadata MUST compare equal.
eq(compareVersions("1.0.0+sha.1234", "1.0.0+sha.5678"), 0, "build metadata stripped (release)");
eq(compareVersions("1.0.0-beta+a", "1.0.0-beta+b"), 0, "build metadata stripped (prerelease) — would fail without explicit '+' handling because 'beta+a' vs 'beta+b' compares lex");
eq(compareVersions("1.0.1+x", "1.0.0+y"), 1, "patch bump still wins despite metadata noise on both sides");

// --- Leading "v" — GitHub release tags use it; if it leaks into version.json,
//     parseInt('v1') is NaN and NaN comparisons return random results.
eq(compareVersions("v1.0.0", "v0.9.0"), 1, "leading 'v' on both sides — without strip this returns 1 by accident (NaN<NaN is false)");
eq(compareVersions("v0.9.0", "v1.0.0"), -1, "antisymmetric of above — without strip BOTH directions return 1 (proves NaN issue)");
eq(compareVersions("v1.0.0", "0.9.0"), 1, "mixed: tag vs clean");

// --- Antisymmetry property: cmp(a,b) === -cmp(b,a) for all (a,b) ---
function antisym(a, b, label) {
	var ab = compareVersions(a, b);
	var ba = compareVersions(b, a);
	if (ab + ba !== 0) {
		console.log("FAIL antisymmetric: " + label + "  cmp(a,b)=" + ab + ", cmp(b,a)=" + ba);
		process.exitCode = 1;
	} else {
		console.log("OK   antisymmetric: " + label);
	}
}
antisym("1.0.0-rc.1", "1.0.0", "prerelease vs release");
antisym("0.10.0-beta.1.2", "0.10.0-beta.1", "extra prerelease id");
antisym("v1.0.0", "0.9.0", "tag-prefix mixed forms (regression for the NaN trap)");
antisym("1.0.0+a", "1.0.0+b", "build-metadata-only difference");

// --- Sorted chain: every neighbour must compare strictly less. Catches
//     transitivity bugs and operator-confusion mistakes (returning bool not number).
var chain = ["0.9.0", "0.10.0-alpha.1", "0.10.0-beta.1", "0.10.0-rc.1", "0.10.0", "0.10.1"];
for (var i = 0; i < chain.length - 1; i++) {
	eq(compareVersions(chain[i], chain[i + 1]), -1, "chain: " + chain[i] + " < " + chain[i + 1]);
}

// --- Return type contract (some callers do `> 0` / `< 0`, breaks if returns boolean) ---
eq(typeof compareVersions("1.0.0", "0.9.0"), "number", "returns a number type, not boolean");

// --- Short forms that callers may actually feed in ---
eq(compareVersions("1.2", "1.2.0"), 0, "missing patch treated as 0 — defends caller laziness");

// ===========================================================================
// Adversarial battery — try to break the library with realistic crap
// ===========================================================================

// Empty / nullish — version.json field could be missing, blank, or set to null
eq(compareVersions("", ""), 0, "empty == empty");
eq(compareVersions("", "1.0.0"), -1, "empty must be the LOWEST version (NaN-trap would return 1)");
eq(compareVersions("1.0.0", ""), 1, "antisymmetric of above");
eq(compareVersions(null, "1.0.0"), -1, "null is NOT the literal string 'null' — must compare as lowest");
eq(compareVersions("1.0.0", undefined), 1, "undefined treated as lowest");
eq(compareVersions(null, undefined), 0, "null == undefined (both sentinel-low)");

// Whitespace contamination — JSON could pick up stray spaces or newlines
eq(compareVersions("  1.0.0", "1.0.0"), 0, "leading whitespace tolerated");
eq(compareVersions("1.0.0\n", "1.0.0"), 0, "trailing newline tolerated");
eq(compareVersions("\t v1.0.0 ", "1.0.0"), 0, "the real trap: leading whitespace defeats /^v/i strip → parseInt('\\tv1')=NaN → wrong answer");

// Sort integration — broken comparator (booleans, NaN, intransitive) corrupts Array.sort.
// If any of the above failures slip in, the sort produces garbage in some permutation.
var shuffled = ["0.10.0", "0.9.0", "0.10.0-rc.1", "0.10.0-alpha.1", "0.10.1", "0.11.0-beta", "0.10.0-beta.1"];
var expected = ["0.9.0", "0.10.0-alpha.1", "0.10.0-beta.1", "0.10.0-rc.1", "0.10.0", "0.10.1", "0.11.0-beta"];
eq(JSON.stringify(shuffled.slice().sort(compareVersions)), JSON.stringify(expected),
   "Array.sort with comparator produces a fully-ordered chain across release/prerelease boundaries");

// Reflexivity over adversarial inputs — cmp(x,x) MUST be 0, even for malformed values
["", "  ", "0", "0.0", "v1.0.0", "1.0.0+sha", "1.0.0-rc.1+x", "1.0.0-", "1.2.3.4.5"].forEach(function (x) {
	eq(compareVersions(x, x), 0, "reflexive: " + JSON.stringify(x));
});

// Transitivity probe — pick a triple that crosses both numeric and prerelease paths
eq(compareVersions("0.9.0", "0.10.0-rc.1"), -1, "transitivity lhs");
eq(compareVersions("0.10.0-rc.1", "0.10.0"), -1, "transitivity mid");
eq(compareVersions("0.9.0", "0.10.0"), -1, "transitivity skip-middle (catches if any path returns 0 by accident)");

// parseInt quirks — these are inputs that SHOULDN'T change precedence
eq(compareVersions("1e5.0.0", "1.0.0"), 0, "parseInt('1e5')=1, NOT 100000 — versions parse equal (documented quirk; if this regresses we silently mis-rank)");
eq(compareVersions("01.02.03", "1.2.3"), 0, "leading zeros in main version stripped by parseInt");

// Float precision boundary — parseInt loses precision past 2^53 (Number.MAX_SAFE_INTEGER)
// UNFIXABLE without BigInt; this test documents the ceiling so future regressions are visible
eq(compareVersions("9007199254740993.0.0", "9007199254740992.0.0"), 0, "PRECISION LIMIT: minor numbers past 2^53 collapse to equal — acceptable for realistic version numbers (max safe ~9 quadrillion)");

console.log("done");
