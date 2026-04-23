"use strict";

// Copy the `version` field from package.json into addon/manifest.json so they
// stay in sync. Run manually or via `npm run sync-version` before a build.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifestPath = path.join(root, "addon", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.version === pkg.version) {
	console.log("manifest already at " + pkg.version);
} else {
	console.log("manifest " + manifest.version + " -> " + pkg.version);
	manifest.version = pkg.version;
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}
