"use strict";
require("../addon/libs/validate.js");
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

function isErr(actual, label) {
	if (typeof actual === "string" && actual.length > 0) {
		console.log("OK   " + label);
	} else {
		console.log("FAIL " + label + "  (expected an error string)");
		console.log("  actual: " + JSON.stringify(actual));
		process.exitCode = 1;
	}
}

// --- accepted values ---
eq(validateBackupDir(""), null, "empty is OK (uses default)");
eq(validateBackupDir(undefined), null, "undefined is OK");
eq(validateBackupDir("twBackups"), null, "single segment");
eq(validateBackupDir("nested/twBackups"), null, "relative nested (posix sep)");
eq(validateBackupDir("nested\\twBackups"), null, "relative nested (win sep)");
eq(validateBackupDir("my.backups"), null, "dot in name is fine");
eq(validateBackupDir("dir-with_underscore"), null, "punctuation that's allowed");

// --- absolute paths rejected ---
isErr(validateBackupDir("/absolute"), "leading '/' rejected");
isErr(validateBackupDir("\\absolute"), "leading '\\' rejected");
isErr(validateBackupDir("C:\\Downloads\\twBackups"), "drive-letter absolute rejected");
isErr(validateBackupDir("d:/downloads"), "lowercase drive-letter rejected");

// --- parent-escape rejected ---
isErr(validateBackupDir(".."), "'..' alone rejected");
isErr(validateBackupDir("../twBackups"), "leading '..' rejected");
isErr(validateBackupDir("a/../b"), "'..' segment in middle rejected");
isErr(validateBackupDir("foo\\..\\bar"), "'..' segment with win sep rejected");

// --- forbidden chars ---
isErr(validateBackupDir("with<angle"), "'<' rejected");
isErr(validateBackupDir("with>angle"), "'>' rejected");
isErr(validateBackupDir("with:colon"), "':' (other than drive) rejected");
isErr(validateBackupDir("with|pipe"), "'|' rejected");
isErr(validateBackupDir("with?quest"), "'?' rejected");
isErr(validateBackupDir("with*star"), "'*' rejected");
isErr(validateBackupDir('with"quote'), "'\"' rejected");

console.log("done");
