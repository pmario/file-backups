"use strict";

// Compare two SemVer-shaped version strings.
// Returns -1 if a < b, 0 if equal, 1 if a > b.
// Implements precedence rules from semver.org §11:
//   - major.minor.patch compared numerically
//   - a version with a prerelease suffix has lower precedence than one without
//   - prerelease identifiers compared field by field; numeric < alphanumeric;
//     numeric fields compared numerically, alphanumeric lexicographically;
//     a shorter set of fields has lower precedence than a longer one with
//     equal prefix.

(function (root) {
	function isNumeric(s) {
		return /^\d+$/.test(s);
	}

	function compareVersions(a, b) {
		// Normalise both sides:
		//   - null/undefined → "" (lowest sentinel; falls through to parseInt
		//     of the empty segment which the `|| "0"` fallback below treats as 0).
		//     Without this, String(null) === "null" → parseInt("null") === NaN
		//     → cmp returns 1 in BOTH directions, breaking antisymmetry.
		//   - .trim() must run BEFORE the /^v/i strip; otherwise "  v1.0.0"
		//     keeps its 'v' and parseInt(" v1") is NaN.
		//   - "+..." build-metadata suffix is dropped per semver.org §10
		//     ("build metadata MUST be ignored when determining precedence").
		a = (a == null ? "" : String(a)).trim().replace(/^v/i, "").split("+")[0];
		b = (b == null ? "" : String(b)).trim().replace(/^v/i, "").split("+")[0];

		if (a === b) return 0;

		var aDash = a.indexOf("-");
		var bDash = b.indexOf("-");
		var aMain = aDash === -1 ? a : a.slice(0, aDash);
		var bMain = bDash === -1 ? b : b.slice(0, bDash);
		var aPre = aDash === -1 ? "" : a.slice(aDash + 1);
		var bPre = bDash === -1 ? "" : b.slice(bDash + 1);

		var aParts = aMain.split(".");
		var bParts = bMain.split(".");
		for (var i = 0; i < 3; i++) {
			var av = parseInt(aParts[i] || "0", 10);
			var bv = parseInt(bParts[i] || "0", 10);
			if (av !== bv) return av < bv ? -1 : 1;
		}

		// major.minor.patch equal — prerelease suffix decides.
		if (!aPre && !bPre) return 0;
		if (!aPre) return 1;  // a is a release, b is a prerelease
		if (!bPre) return -1;

		var aIds = aPre.split(".");
		var bIds = bPre.split(".");
		var len = Math.max(aIds.length, bIds.length);
		for (var j = 0; j < len; j++) {
			var aId = aIds[j];
			var bId = bIds[j];
			if (aId === undefined) return -1;
			if (bId === undefined) return 1;
			var aN = isNumeric(aId);
			var bN = isNumeric(bId);
			if (aN && bN) {
				var an = parseInt(aId, 10);
				var bn = parseInt(bId, 10);
				if (an !== bn) return an < bn ? -1 : 1;
			} else if (aN) {
				return -1; // numeric identifiers have lower precedence than alphanumeric
			} else if (bN) {
				return 1;
			} else if (aId !== bId) {
				return aId < bId ? -1 : 1;
			}
		}
		return 0;
	}

	root.compareVersions = compareVersions;
})(typeof globalThis !== "undefined" ? globalThis : this);
