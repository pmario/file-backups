"use strict";

// Sync `version` from package.json into:
//   - addon/manifest.json
//   - version.json at repo root: also derives `beta` from segment count
//     (4 segments = beta, 3 = stable).
//
// version.json's released_at + url are NOT touched — those are release-time
// concerns the maintainer edits per RELEASING.md.
//
// Run manually via `npm run sync-version`, or as part of `npm run stage`
// (which additionally bumps the 4th segment first).

const fs = require("fs");
const path = require("path");
require("../addon/libs/compare-versions.js");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// 1. Sync to addon/manifest.json
const manifestPath = path.join(root, "addon", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.version === pkg.version) {
	console.log("copy-version: manifest already at " + pkg.version);
} else {
	console.log("copy-version: manifest " + manifest.version + " -> " + pkg.version);
	manifest.version = pkg.version;
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

// 2. Sync to docs/version.json (preserves released_at + url; updates version + beta only).
// Lives under docs/ so the GitHub Pages deploy publishes it as
// https://pmario.github.io/file-backups/version.json directly — no extra
// copy step in the sign workflows.
const versionJsonPath = path.join(root, "docs", "version.json");
let existing = {};
try {
	existing = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
} catch (err) { /* missing or unparseable — will create */ }

const isBeta = parseVersion(pkg.version).isBeta;
const next = Object.assign({}, existing, {
	version: pkg.version,
	beta: isBeta
});

if (JSON.stringify(existing) === JSON.stringify(next)) {
	console.log("copy-version: version.json already at " + pkg.version + " / beta:" + isBeta);
} else {
	console.log("copy-version: version.json -> " + pkg.version + " / beta:" + isBeta);
	fs.writeFileSync(versionJsonPath, JSON.stringify(next, null, 2) + "\n");
}
