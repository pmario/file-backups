"use strict";

// Scans addon/tiddlers/ for .tid files and writes a manifest at
// addon/tiddlers/index.json that the bridge fetches at runtime, so the bridge
// no longer needs hardcoded file lists.
//
//   real   — top-level .tid files become real tiddlers in the wiki
//   shadow — .tid files anywhere under tiddlers/plugin/** become shadows in
//            the runtime plugin bundle
//
// Run automatically as a pre-script before web-ext run / build via package
// .json. Also runnable directly: `node build-tools/index-tiddlers.js`.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "addon", "tiddlers");
const PLUGIN_DIR = path.join(ROOT, "plugin");
const OUTPUT = path.join(ROOT, "index.json");

function listTopLevelTids(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, {withFileTypes: true})
		.filter(e => e.isFile() && e.name.endsWith(".tid"))
		.map(e => e.name)
		.sort();
}

function listTidsRecursive(dir) {
	if (!fs.existsSync(dir)) return [];
	const out = [];
	for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...listTidsRecursive(full));
		} else if (entry.isFile() && entry.name.endsWith(".tid")) {
			out.push(full);
		}
	}
	return out.sort();
}

const real = listTopLevelTids(ROOT).map(name => "tiddlers/" + name);

const shadow = listTidsRecursive(PLUGIN_DIR)
	.map(full => "tiddlers/" + path.relative(ROOT, full).replace(/\\/g, "/"));

fs.writeFileSync(OUTPUT, JSON.stringify({real, shadow}, null, 2) + "\n");
console.log(`index-tiddlers: ${real.length} real + ${shadow.length} shadow → ${path.relative(process.cwd(), OUTPUT)}`);
