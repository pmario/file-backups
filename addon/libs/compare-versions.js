"use strict";

// Parse and compare Firefox-shaped version strings — 1 to 4 dot-separated
// numbers, per Firefox manifest.json's version-format rule. Letters and
// SemVer-style "-prerelease" / "+buildmeta" suffixes are NOT allowed by
// AMO, so we don't try to handle them.
//
// Convention used by this project:
//   3 segments  → stable release  (e.g. 0.9.0)
//   4 segments  → beta build      (e.g. 0.9.0.1, 0.9.0.2, ...)
// The 4th number is the beta counter. 0.9.0.5 is a higher version than
// 0.9.0 (the stable), so the next stable after a beta cycle is 0.9.1
// (or 0.10.0), never back to 0.9.0.
//
// parseVersion(v) → {segments, isBeta}
//   segments  array of integers
//   isBeta    segments.length === 4
//
// compareVersions(a, b) → -1 / 0 / 1
//   Missing segments are treated as 0, so "0.9.0" === "0.9.0.0".
//   Nullish / empty / non-numeric inputs sort as the lowest possible value.

(function (root) {
	function parseVersion(v) {
		var s = (v == null ? "" : String(v)).trim();
		if (!s) return {segments: [], isBeta: false};
		var segments = s.split(".").map(function (p) {
			var n = parseInt(p, 10);
			return isNaN(n) ? 0 : n;
		});
		return {segments: segments, isBeta: segments.length === 4};
	}

	function compareVersions(a, b) {
		var pa = parseVersion(a).segments;
		var pb = parseVersion(b).segments;
		var len = Math.max(pa.length, pb.length);
		for (var i = 0; i < len; i++) {
			var av = pa[i] || 0;
			var bv = pb[i] || 0;
			if (av !== bv) return av < bv ? -1 : 1;
		}
		return 0;
	}

	root.parseVersion = parseVersion;
	root.compareVersions = compareVersions;
})(typeof globalThis !== "undefined" ? globalThis : this);
