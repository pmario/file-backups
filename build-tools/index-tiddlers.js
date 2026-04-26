"use strict";

// Scans addon/tiddlers/ for .tid files and writes a manifest at
// addon/tiddlers/index.json that the bridge fetches at runtime, so the bridge
// no longer needs hardcoded file lists.
//
//   real   — top-level .tid files become real tiddlers in the wiki
//   shadow — .tid files anywhere under tiddlers/plugin/** become shadows in
//            the runtime plugin bundle
//
// Build-time gate for the dev test affordance:
//   addon/tiddlers/plugin/test/ is included ONLY when the repo-root
//   version.json has beta:true. Stable releases ship without the test
//   tiddlers, so the CP test buttons aren't user-visible in production.
//
// Run automatically as a pre-script before web-ext run / build via package
// .json. Also runnable directly: `node build-tools/index-tiddlers.js`.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const ROOT = path.join(REPO_ROOT, "addon", "tiddlers");
const PLUGIN_DIR = path.join(ROOT, "plugin");
const TEST_DIR = path.join(PLUGIN_DIR, "test");
const VERSION_JSON = path.join(REPO_ROOT, "version.json");
const OUTPUT = path.join(ROOT, "index.json");

let isBetaBuild = false;
try {
	const v = JSON.parse(fs.readFileSync(VERSION_JSON, "utf8"));
	isBetaBuild = v.beta === true;
} catch (err) {
	// Missing or unparseable version.json → treat as stable (safer default —
	// no test tiddlers ship). The release process has its own check.
	isBetaBuild = false;
}

function listTopLevelTids(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, {withFileTypes: true})
		.filter(e => e.isFile() && e.name.endsWith(".tid"))
		.map(e => e.name)
		.sort();
}

function listTidsRecursive(dir, opts) {
	opts = opts || {};
	const skipDir = opts.skipDir || null;
	if (!fs.existsSync(dir)) return [];
	const out = [];
	for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
		const full = path.join(dir, entry.name);
		if (skipDir && full === skipDir) continue;
		if (entry.isDirectory()) {
			out.push(...listTidsRecursive(full, opts));
		} else if (entry.isFile() && entry.name.endsWith(".tid")) {
			out.push(full);
		}
	}
	return out.sort();
}

const real = listTopLevelTids(ROOT).map(name => "tiddlers/" + name);

const shadow = listTidsRecursive(PLUGIN_DIR, isBetaBuild ? {} : {skipDir: TEST_DIR})
	.map(full => "tiddlers/" + path.relative(ROOT, full).replace(/\\/g, "/"));

fs.writeFileSync(OUTPUT, JSON.stringify({real, shadow}, null, 2) + "\n");
const buildLabel = isBetaBuild ? "beta build (test/ included)" : "stable build (test/ excluded)";
console.log(`index-tiddlers: ${real.length} real + ${shadow.length} shadow → ${path.relative(process.cwd(), OUTPUT)} [${buildLabel}]`);
