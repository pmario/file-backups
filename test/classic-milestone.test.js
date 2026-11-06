"use strict";
const ms = require("../addon/classic/milestone.js");
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

// --- formatTimestamp (local time, TW5 <<now "YYYY-0MM-0DD-0hh-0mm-0ss">>) ---
eq(ms.formatTimestamp(new Date(2026, 10, 6, 9, 5, 3)), "2026-11-06-09-05-03", "zero-padded");
eq(ms.formatTimestamp(new Date(2026, 0, 31, 23, 59, 59)), "2026-01-31-23-59-59", "end of day");

// --- clampLabel ---
eq(ms.clampLabel("  release 1.0  "), "release 1.0", "trims");
eq(ms.clampLabel("x".repeat(45)), "x".repeat(40), "max 40 characters");
eq(ms.clampLabel(undefined), "", "undefined → empty");

// --- historyValue ---
eq(ms.historyValue("v1", "first draft"), "v1 - first draft", "label + description");
eq(ms.historyValue("v1", ""), "v1", "label only");
eq(ms.historyValue("", "first draft"), "first draft", "description only");
eq(ms.historyValue("  ", "  "), "", "both empty");

// --- parseDictionary ---
eq(ms.parseDictionary("2026-01-01-10-00-00: a\n2026-01-02-10-00-00: b - c"),
	[{ts: "2026-01-01-10-00-00", value: "a"}, {ts: "2026-01-02-10-00-00", value: "b - c"}],
	"two lines");
eq(ms.parseDictionary("2026-01-01-10-00-00: time 12:30"),
	[{ts: "2026-01-01-10-00-00", value: "time 12:30"}], "splits on the first colon only");
eq(ms.parseDictionary("2026-01-01-10-00-00:"), [{ts: "2026-01-01-10-00-00", value: ""}], "empty value");
eq(ms.parseDictionary("\nno colon here\n: no key\r\n2026-01-01-10-00-00: x\r\n"),
	[{ts: "2026-01-01-10-00-00", value: "x"}], "skips junk lines, handles CRLF");
eq(ms.parseDictionary(""), [], "empty text");
eq(ms.parseDictionary(undefined), [], "undefined text");

// --- addEntry ---
eq(ms.addEntry("", "2026-01-01-10-00-00", "a"), "2026-01-01-10-00-00: a", "first entry");
eq(ms.addEntry("2026-01-02-10-00-00: b", "2026-01-01-10-00-00", "a"),
	"2026-01-01-10-00-00: a\n2026-01-02-10-00-00: b", "kept sorted oldest first");
eq(ms.addEntry("2026-01-01-10-00-00: old", "2026-01-01-10-00-00", "new"),
	"2026-01-01-10-00-00: new", "same timestamp replaces");

// --- recentEntries ---
const seven = [1, 2, 3, 4, 5, 6, 7].map((d) => "2026-01-0" + d + "-10-00-00: m" + d).join("\n");
eq(ms.recentEntries(seven, 5).map((e) => e.value), ["m7", "m6", "m5", "m4", "m3"], "newest 5 first");
eq(ms.recentEntries("", 5), [], "none yet");

// --- Classic title; line format is the same as TW5's $:/milestones ---
eq(ms.MILESTONES_TITLE, "Milestones", "Classic tiddler title (no TW5 $:/ prefix)");
eq(ms.LABEL_MAX, 40, "same label limit as TW5");

console.log("done");
