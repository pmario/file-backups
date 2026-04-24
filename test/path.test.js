"use strict";
require("../addon/libs/path.js");
const w = pathLib.win32, p = pathLib.posix;
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

// ---- WIN32 ----
eq(w.sep, "\\", "win32.sep");

eq(w.parse("C:\\Users\\foo\\Downloads\\myWikis\\notes.html"), {
	root: "C:\\",
	dir: "C:\\Users\\foo\\Downloads\\myWikis",
	base: "notes.html",
	ext: ".html",
	name: "notes"
}, "win32.parse absolute");

eq(w.basename("C:\\Users\\foo\\Downloads\\myWikis\\notes.html"), "notes.html", "win32.basename");

eq(w.isAbsolute("C:\\Users"), true, "win32.isAbsolute drive");
eq(w.isAbsolute("C:/Users"), true, "win32.isAbsolute drive fwd-slash");
eq(w.isAbsolute("\\\\server\\share"), true, "win32.isAbsolute UNC");
eq(w.isAbsolute("sub\\dir"), false, "win32.isAbsolute relative");

eq(w.join("myWikis", "twBackups", "notes.html"),
   "myWikis\\twBackups\\notes.html", "win32.join basic");

eq(w.join(".\\", "twBackups", "notes.html", "notes(A).html"),
   "twBackups\\notes.html\\notes(A).html", "win32.join collapses leading .\\ (Firefox downloads requires this)");

eq(w.join(".\\", "index.html"),
   "index.html", "win32.join .\\+file collapses to bare filename");

eq(w.join("./", "index.html"),
   "index.html", "win32.join ./+file collapses to bare filename");

eq(w.join(".", "index.html"),
   "index.html", "win32.join .+file collapses");

eq(w.join("foo", ".", "bar"),
   "foo\\bar", "win32.join drops mid . segments");

eq(w.join("..", "foo"),
   "..\\foo", "win32.join preserves ..");

// Windows users may enter forward slashes in the backupdir field. Our win32
// join must normalise both to backslash so downloads.download accepts the
// resulting filename.
eq(w.join(".", "my/nested", "notes.html", "notes(A).html"),
   "my\\nested\\notes.html\\notes(A).html", "win32.join normalises user-entered forward slashes");

eq(w.join(".", "a/b\\c", "notes.html"),
   "a\\b\\c\\notes.html", "win32.join normalises mixed / and \\ in one input");

eq(w.join(".", "a//b///c", "notes.html"),
   "a\\b\\c\\notes.html", "win32.join collapses duplicate separators");

eq(w.join("foo/bar", "baz/qux"),
   "foo\\bar\\baz\\qux", "win32.join normalises slashes at boundaries");

eq(w.relative(
	"C:\\Users\\foo\\Downloads\\beakon.tmp.html",
	"C:\\Users\\foo\\Downloads\\myWikis"
), "..\\myWikis", "win32.relative beakon->wikis");

eq(w.relative(
	"C:\\Users\\foo\\Downloads",
	"C:\\Users\\foo\\Downloads"
), "", "win32.relative same");

eq(w.relative(
	"C:\\Users\\foo\\Downloads",
	"D:\\other"
), "D:\\other", "win32.relative diff root");

eq(w.format({ root: "C:\\", dir: "C:\\Users\\foo", base: "notes.html" }),
   "C:\\Users\\foo\\notes.html", "win32.format");

eq(w.format({ dir: "C:\\Users\\foo", name: "notes", ext: ".html" }),
   "C:\\Users\\foo\\notes.html", "win32.format name+ext");

const el = w.parse("C:\\Users\\foo\\Downloads\\beakon.tmp.html");
el.base = ""; el.name = ""; el.ext = "";
eq(w.format(el), "C:\\Users\\foo\\Downloads\\", "win32.format stripped-base (defaultDir pattern)");

// ---- POSIX ----
eq(p.sep, "/", "posix.sep");

eq(p.parse("/home/foo/Downloads/myWikis/notes.html"), {
	root: "/",
	dir: "/home/foo/Downloads/myWikis",
	base: "notes.html",
	ext: ".html",
	name: "notes"
}, "posix.parse absolute");

eq(p.relative(
	"/home/foo/Downloads/beakon.tmp.html",
	"/home/foo/Downloads/myWikis"
), "../myWikis", "posix.relative beakon->wikis");

eq(p.relative("/a/b/c", "/a/b/c"), "", "posix.relative same");

eq(p.join("myWikis", "twBackups", "notes.html"),
   "myWikis/twBackups/notes.html", "posix.join");

eq(p.join("./", "index.html"),
   "index.html", "posix.join ./+file collapses");

eq(p.join(".", "foo", ".", "bar"),
   "foo/bar", "posix.join drops . segments");

// On POSIX, backslash is a legal filename character, not a separator. Lock in
// the Node-compatible behaviour: backslashes in user input stay literal.
eq(p.join(".", "my\\nested", "notes.html"),
   "my\\nested/notes.html", "posix.join keeps backslash literal (not a separator)");

eq(p.join(".", "a\\b", "c"),
   "a\\b/c", "posix.join treats 'a\\b' as a single segment");

eq(p.parse("my\\nested/notes.html"), {
	root: "",
	dir: "my\\nested",
	base: "notes.html",
	ext: ".html",
	name: "notes"
}, "posix.parse treats backslash as part of a name");

eq(p.basename("/home/foo/my\\wiki.html"),
   "my\\wiki.html", "posix.basename returns backslash-containing filename verbatim");

eq(p.isAbsolute("/foo"), true, "posix.isAbsolute abs");
eq(p.isAbsolute("foo"), false, "posix.isAbsolute rel");

console.log("\ndone");
