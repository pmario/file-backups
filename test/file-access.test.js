"use strict";
require("../addon/libs/file-access.js");
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

const UA_FX159 = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/159.0";
const UA_FX152 = "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/152.0";
const UA_FX115 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0";
const UA_CHROME = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

// --- firefoxMajorVersion ---
eq(firefoxMajorVersion(UA_FX159, null), 159, "UA Firefox/159");
eq(firefoxMajorVersion(UA_FX115, null), 115, "UA Firefox/115 (ESR)");
eq(firefoxMajorVersion(UA_FX159, {name: "Waterfox", version: "6.5.0"}), 159, "fork: UA token wins over fork's own version");
eq(firefoxMajorVersion("", {name: "Firefox", version: "160.0b3"}), 160, "no UA token: falls back to getBrowserInfo");
eq(firefoxMajorVersion("", {name: "LibreWolf", version: "x"}), null, "no UA token, non-Firefox info: unknown");
eq(firefoxMajorVersion(UA_CHROME, null), null, "Chromium: null");
eq(firefoxMajorVersion(undefined, undefined), null, "nothing known: null");
eq(firefoxMajorVersion("rv:160.0", null), null, "frozen rv: token is ignored");

// --- fileAccessAllowed ---
// Firefox 48-152: API always returned false — must NOT raise the alarm.
eq(fileAccessAllowed(152, false), true, "Fx152 + false → ignored, allowed");
eq(fileAccessAllowed(115, false), true, "Fx115 ESR + false → ignored, allowed");
// Firefox 153+: trust the API.
eq(fileAccessAllowed(FILE_ACCESS_MIN_FIREFOX, false), false, "Fx153 + false → not allowed");
eq(fileAccessAllowed(159, false), false, "Fx159 + false → not allowed");
eq(fileAccessAllowed(159, true), true, "Fx159 + true → allowed");
// Chromium (no Firefox version): trust the API.
eq(fileAccessAllowed(null, false), false, "Chromium + false → not allowed");
eq(fileAccessAllowed(null, true), true, "Chromium + true → allowed");
// Unknown API result: never a false alarm.
eq(fileAccessAllowed(159, null), true, "Fx159 + API threw → allowed");
eq(fileAccessAllowed(159, undefined), true, "Fx159 + API missing → allowed");

// --- end to end (UA → decision) ---
eq(fileAccessAllowed(firefoxMajorVersion(UA_FX152, null), false), true, "e2e Fx152 UA + false → allowed");
eq(fileAccessAllowed(firefoxMajorVersion(UA_FX159, null), false), false, "e2e Fx159 UA + false → not allowed");

// --- isLocalHtmlUrl ---
eq(isLocalHtmlUrl("file:///home/me/Notes.html"), true, "local .html");
eq(isLocalHtmlUrl("file:///home/me/Notes.htm"), true, "local .htm");
eq(isLocalHtmlUrl("file:///home/me/Notes.HTML"), true, "upper-case extension");
eq(isLocalHtmlUrl("file:///C:/Users/me/Notes.html"), true, "Windows drive path");
eq(isLocalHtmlUrl("file:///home/me/my%20notes.html"), true, "encoded space");
eq(isLocalHtmlUrl("file:///home/me/Notes.html#Tiddler"), true, "with #fragment");
eq(isLocalHtmlUrl("file:///home/me/Notes.html?x=1"), true, "with ?query");
eq(isLocalHtmlUrl("file:///home/me/Notes.htmlx"), false, "not .htmlx");
eq(isLocalHtmlUrl("file:///home/me/Notes.txt"), false, "not .txt");
eq(isLocalHtmlUrl("file:///home/me/"), false, "directory listing");
eq(isLocalHtmlUrl("https://example.org/Notes.html"), false, "https is not local");
eq(isLocalHtmlUrl("about:addons"), false, "about: page");
eq(isLocalHtmlUrl(undefined), false, "undefined");
eq(isLocalHtmlUrl(null), false, "null");

console.log("done");
