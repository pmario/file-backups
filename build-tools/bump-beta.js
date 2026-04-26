"use strict";

// Auto-bump the LAST segment of package.json.version on each `npm run stage`.
// Works on both shapes:
//   3-segment stable  →  bump the 3rd (patch)        e.g. 0.9.1   → 0.9.2
//   4-segment beta    →  bump the 4th (beta count)   e.g. 0.9.0.1 → 0.9.0.2
// Empty / nullish versions are skipped (nothing to bump).
//
// Each web-ext run / build / lint triggers stage, so the counter advances
// every dev iteration. To start a new beta cycle from a fresh stable, the
// maintainer manually appends a 4th segment (e.g. 0.9.0 → 0.9.0.1); to cut
// a stable release after a beta cycle, strip the 4th segment and bump the
// 3rd by hand (e.g. 0.9.0.5 → 0.9.1).
//
// CI sign workflows MUST NOT bump — the maintainer commits the exact
// version they want signed, and CI signs that version. Otherwise the
// signed .xpi / GitHub Release tag drift one ahead of the repo state on
// every CI run. We detect CI via the universal `CI=true` env var that
// GitHub Actions (and most CI providers) set automatically.

const fs = require("fs");
const path = require("path");
require("../addon/libs/compare-versions.js");

if (process.env.CI === "true") {
	console.log("bump-beta: CI environment detected, skipping (CI signs the version that's committed)");
	process.exit(0);
}

const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const p = parseVersion(pkg.version);
if (p.segments.length === 0) {
	console.log("bump-beta: no version to bump in '" + pkg.version + "', skipping");
	process.exit(0);
}

const segs = p.segments.slice();
segs[segs.length - 1] = segs[segs.length - 1] + 1;
const next = segs.join(".");
console.log("bump-beta: " + pkg.version + " -> " + next);
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, "\t") + "\n");
