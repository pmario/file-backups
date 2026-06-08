'use strict';

if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

const PLUGIN_NAME = "file-backups"

// Backup-awareness reminder display state (phase 3). The active reminders for
// THIS wiki, set from the save response (real triggers) or the dev test buttons.
// fbWikiPath is captured during a save so Snooze can tell the background which
// wiki to write snoozedUntil for.
var fbReminders = {milestone: null, count: null, size: null};
var fbWikiPath = null;
// Set at startup when the open file is itself a tracked backup (milestone or
// rotation slot): {mainWikiPath, mainWikiUrl, kind, entry}. Drives the backup
// banner + a notice in the summary, both linking back to the main wiki.
var fbBackupContext = null;

// This wiki's location WITHOUT the #fragment — TiddlyWiki rewrites the fragment
// as you navigate, so it must not be part of any key comparison.
function fbWikiUrl() {
	return (document.URL || "").split("#")[0];
}

// Build a clickable file:// URL from a stored wiki path (a storage.local key, an
// OS path with backslashes on Windows). Used to link from a milestone snapshot
// back to its main wiki. encodeURI keeps the drive-letter ':' and '/' separators
// while escaping spaces etc.
function fbPathToUrl(p) {
	if (!p) return null;
	var s = String(p).replace(/\\/g, "/");
	if (/^file:/i.test(s)) return s;
	return "file:///" + encodeURI(s.replace(/^\/+/, ""));
}

// Normalise a path / URL-path for comparison: decode %xx, unify slashes, drop a
// leading slash, lowercase (Windows paths are case-insensitive). This lets us
// match this wiki's file:// URL against the file-path keys in storage.local at
// STARTUP, with no prior save needed to learn the exact key.
function fbNorm(s) {
	try { s = decodeURIComponent(String(s)); } catch (e) { s = String(s); }
	return s.toLowerCase().replace(/^file:\/+/, "").replace(/\\/g, "/").replace(/^\/+/, "");
}

function fbWikiPathNorm() {
	var p;
	try { p = new URL(fbWikiUrl()).pathname; } catch (e) { p = fbWikiUrl().replace(/^file:\/\//i, ""); }
	return fbNorm(p);
}

// When the extension is (re)installed while a TW tab is already open, the
// background re-injects this script via scripting.executeScript. By that
// point DOMContentLoaded has already fired, so listening for it would never
// run main(). Detect already-loaded documents and call main() directly.
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", main, false);
} else {
	main();
}

/*
var template = [
	{
		tag: "div",
		attr: { name: "class", value: "tests"},
		children: [
			{
				tag: "p",
				attr: [
					{ name: "class", value: "tests"}
					],
				children: [
					{
						text: "some text"
					}
				]
			}
		]
	}
];
*/

function createDomElements(parent, el) {
	let elem,
		newer = parent;

	if (!(newer && newer.appendChild)) {
		newer = document.createElement("div");
	}

	for (let i = 0; i < el.length; i++) {
		if (el[i].tag) {
			elem = document.createElement(el[i].tag);
		} else if (el[i].text) {
			elem = document.createTextNode(el[i].text)
		} else return "error";

		if (el[i].attr) {
			for (let x=0, xMax = el[i].attr.length; x < xMax; x++) {
				elem.setAttribute(el[i].attr[x].name, el[i].attr[x].value);
			}
		}
		if (el[i].children) {
			elem = createDomElements(elem, el[i].children);
		}
		newer.appendChild(elem);
	}
	return newer;
}


// main function
// Derive the owning wiki's URL from a backup folder URL. Backups live at
// <wikiDir>/<backupdir>/<wikiBase>/ (a sibling of the wiki), so the wiki is
// <wikiDir>/<wikiBase> — i.e. drop the backupdir segment.
function fbWikiUrlFromBackupDir(dirUrl) {
	var u = String(dirUrl || "").replace(/\/+$/, "");
	var i1 = u.lastIndexOf("/");
	if (i1 < 0) return null;
	var wikiBase = u.slice(i1 + 1);
	var before = u.slice(0, i1);
	var i2 = before.lastIndexOf("/");
	if (i2 < 0) return null;
	var wikiDir = before.slice(0, i2 + 1);
	if (!wikiBase || !wikiDir) return null;
	return wikiDir + wikiBase;
}

// On a backup folder's directory-listing page (matched via file:///*/), read the
// listing SAME-ORIGIN (a page fetching its own URL — the only file:// read
// Firefox allows us) and sync it into the owning wiki's tracking. Stays silent
// unless the folder belongs to a tracked wiki.
function dirSync() {
	var dirUrl = fbWikiUrl();
	var wikiUrl = fbWikiUrlFromBackupDir(dirUrl);
	if (!wikiUrl) return;
	var wikiNorm;
	try { wikiNorm = fbNorm(new URL(wikiUrl).pathname); } catch (e) { wikiNorm = fbNorm(wikiUrl); }
	browser.storage.local.get(null).then(function (all) {
		var key = null;
		for (var k in all) { if (fbNorm(k) === wikiNorm) { key = k; break; } }
		if (!key) return; // not a tracked wiki's backup folder
		fetch(dirUrl).then(function (r) { return r.text(); }).then(function (text) {
			var files = (typeof parseIndexFormat === "function") ? parseIndexFormat(text) : [];
			var stash = all[key] || {};
			var result = syncScannedFiles(stash, files);
			browser.storage.local.set({[key]: stash}).then(function () {
				renderScanNotice("File Backups synced this folder: " + files.length + " files — " + result.tracked + " tracked, " + result.discovered + " new, " + result.missing + " missing.");
			}).catch(function (e) { renderScanNotice("File Backups: storage write failed: " + (e && e.message)); });
		}).catch(function (err) { renderScanNotice("File Backups: folder read failed: " + (err && err.message)); });
	}).catch(function (e) { renderScanNotice("File Backups: " + (e && e.message)); });
}

function main() {
	// A backup folder's directory-listing page (URL ends with "/"): read + sync it
	// here (same-origin), then stop — the TW machinery below doesn't apply.
	if (/\/$/.test((document.URL || "").split("#")[0])) {
		dirSync();
		return;
	}
	// check, if we are allowed to run!!
	if (isTiddlyWiki5File(document) || isTiddlyWikiClassicFile(document)) {
		injectMessageBox(document);
		checkUrlConflict();
	}
}

// Backup-awareness reminder banner (phase 3). Renders the active reminders for
// this wiki (module state fbReminders) as a dismissible banner at the top of the
// page — the same "inform, never act for you" surface as backendMessage. Driven
// by the save response (real triggers) and the dev test buttons; it is not shown
// on a bare reload between saves. Snooze persists a per-wiki snoozedUntil via the
// background so the kind stays hidden until its window passes.
function renderReminderBanners() {
	var existing = document.getElementById("fb-reminder-banner");
	if (existing) existing.parentNode.removeChild(existing);
	var allKinds = (typeof FB_REMINDER_KINDS !== "undefined") ? FB_REMINDER_KINDS : ["milestone", "count", "size"];
	var kinds = allKinds.filter(function (k) { return typeof fbReminders[k] === "number"; });
	if (!kinds.length) return;

	var banner = document.createElement("div");
	banner.id = "fb-reminder-banner";
	banner.style = "position:fixed; left:0; right:0; top:1em; max-width:60%; margin-left:auto; margin-right:auto; z-index:10000; background:#dbeafe; color:#0c0c0d; border:2px solid #93c5fd; padding:8px 12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px;";

	kinds.forEach(function (kind) {
		var msg = (typeof reminderMessage === "function") ? reminderMessage(kind, fbReminders[kind]) : {text: kind, action: ""};
		var row = document.createElement("div");
		row.style = "display:flex; align-items:center; gap:10px; margin:3px 0;";

		var span = document.createElement("span");
		span.textContent = msg.text;
		span.style = "flex:1;";
		row.appendChild(span);

		if (msg.action) {
			var primary = document.createElement("button");
			primary.textContent = msg.action;
			primary.addEventListener("click", function () { onReminderAction(kind); });
			row.appendChild(primary);
		}

		var snooze = document.createElement("button");
		snooze.textContent = "Snooze";
		snooze.addEventListener("click", function () { snoozeReminder(kind); });
		row.appendChild(snooze);

		banner.appendChild(row);
	});

	document.body.appendChild(banner);
}

// Snooze: hide this reminder now and persist a per-wiki snoozedUntil so the
// background's next save-time evaluation skips it until the window passes. The
// wiki path comes from the last save (fbWikiPath) — a reminder can only be on
// screen after a save produced it, so the path is available. Test-injected
// reminders (no save) just hide locally.
function snoozeReminder(kind) {
	fbReminders[kind] = null;
	renderReminderBanners();
	if (fbWikiPath) {
		browser.runtime.sendMessage({msg: "snoozeReminder", kind: kind, path: fbWikiPath}).then(function (resp) {
			if (resp && resp.until) renderSnoozeNotice(kind, resp.until);
		}).catch(function () {});
	}
}

// Confirm a snooze and, crucially, tell the user HOW LONG it is snoozed — the
// background returns the until-timestamp it wrote. Dismissible.
function renderSnoozeNotice(kind, until) {
	var existing = document.getElementById("fb-snooze-notice");
	if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
	var box = document.createElement("div");
	box.id = "fb-snooze-notice";
	box.style = "position:fixed; left:0; right:0; top:1em; max-width:60%; margin-left:auto; margin-right:auto; padding:8px 12px; background:#dbeafe; border:1px solid #93c5fd; color:#0c0c0d; z-index:10000; font-size:initial;";
	var label = ({milestone: "milestone", count: "file-count", size: "size"})[kind] || kind;
	var days = Math.max(0, Math.round((until - Date.now()) / 86400000 * 10) / 10);
	var span = document.createElement("span");
	span.textContent = "The " + label + " reminder is snoozed until " + fbFormatTs(until) + " (about " + days + " day" + (days === 1 ? "" : "s") + ").";
	box.appendChild(span);
	var ok = document.createElement("button");
	ok.textContent = "OK";
	ok.style = "margin-left:10px;";
	ok.addEventListener("click", function () { if (box.parentNode) box.parentNode.removeChild(box); });
	box.appendChild(ok);
	document.body.appendChild(box);
}

// Backup summary (this wiki). Built from the tracked rotation + milestone data in
// storage.local and injected into the wiki via the bridge at startup (and after
// each save), so the CP can link a read-only overview WITHOUT the wiki having to
// store it. Explicitly an APPROXIMATION: only backups tracked since the AddOn was
// installed are known; older or externally-changed/cleared files are not.
function fbFormatBytes(n) {
	if (typeof n !== "number" || !isFinite(n)) return "?";
	if (n < 1024) return n + " B";
	if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
	return (n / (1024 * 1024)).toFixed(2) + " MB";
}

function fbFormatTs(ts) {
	if (typeof ts !== "number" || !isFinite(ts) || ts <= 0) return "?";
	var d = new Date(ts);
	function p(x) { return (x < 10 ? "0" : "") + x; }
	return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

function fbCell(s) {
	// A literal | in a filename would split the table row; escape it.
	return String(s == null ? "?" : s).replace(/\|/g, "\\|");
}

function fbDirName(filename) {
	if (!filename) return "?";
	var s = String(filename);
	var i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
	return i >= 0 ? s.slice(0, i) : "?";
}

// Clickable file:// URL for a tracked backup: this wiki's directory + the last
// three path segments of the stored filename (backupdir / wiki-base-folder /
// file). Independent of how deep the wiki sits under Downloads. Returns null if
// it can't be built. encodeURIComponent encodes " and spaces, so the result is
// safe inside an HTML href="…".
function fbFileUrl(filename) {
	var u = fbWikiUrl();
	var lastSlash = u.lastIndexOf("/");
	if (lastSlash < 0) return null;
	var wikiDir = u.slice(0, lastSlash + 1);
	var segs = String(filename || "").split(/[\\\/]/).filter(Boolean);
	if (segs.length < 3) return null;
	return wikiDir + segs.slice(-3).map(encodeURIComponent).join("/");
}

function fbGeneratedNote(now) {
	return "<<<\n''Generated at wiki startup'' (" + fbFormatTs(now) + "), refreshed after each save. It lists only backups this AddOn has recorded, so your backup folder may contain more.\n<<<";
}

// "Open backups folder" — a real TW <$button> that sends a widget message. The
// page-context bridge listens for it on $tw.rootWidget and relays it to the
// content script (the only context that can open the OS file manager, via the
// background openBackupFolder handler). A plain file:// link would just list the
// folder inside Firefox rather than opening the system file manager. Shared by
// both summary tiddlers so the markup can't drift.
function fbOpenBackupsButton() {
	return "<$button class=\"fb-open-backups\"><$action-sendmessage $message=\"tm-file-backups-show-backups\"/>Open backups folder</$button>";
}

// Which list a folder-sync-discovered file belongs to, by filename shape:
// rotation slots end with "(X)" (a single letter) or the first-slot date form
// "(…T…Z)"; everything else is treated as a milestone.
function fbDiscoveredKind(name) {
	var m = String(name || "").match(/\(([^()]*)\)(?:-[^()]*)?\.html?$/i);
	if (!m) return "milestone";
	var inner = m[1];
	return (/^[A-Za-z]$/.test(inner) || /T.*Z$/.test(inner)) ? "rotation" : "milestone";
}

// The timestamp embedded in a backup filename ("(…)") — the only "date" we have
// for a folder-sync-discovered file (it carries no tracked ts).
function fbNameTimestamp(name) {
	var m = String(name || "").match(/\(([^()]*)\)(?:-[^()]*)?\.html?$/i);
	return (m && m[1]) ? m[1] : "?";
}

// Folder-sync-discovered files (stash.discovered, source "scan") for one kind,
// as display rows. They carry only name + size.
function fbDiscoveredRows(stash, kind) {
	var disc = (stash && Array.isArray(stash.discovered)) ? stash.discovered : [];
	return disc.filter(function (d) { return d && d.name && fbDiscoveredKind(d.name) === kind; })
		.map(function (d) { return {name: d.name, size: d.size, source: "scan"}; });
}

// Source label for a row: download-tracked vs found by the folder sync.
function fbSource(e) { return (e && e.source === "scan") ? "Folder sync" : "downloads"; }

// Rotation entries (newest first) and their table — shared by the full tiddler
// and the latest-5 CP preview. Download-tracked slots are tagged "downloads";
// folder-sync-discovered rotation files are appended.
function fbRotationRows(stash) {
	var rot = (stash && stash.rotation && typeof stash.rotation === "object" && !Array.isArray(stash.rotation)) ? stash.rotation : {};
	var rows = Object.keys(rot).map(function (k) {
		var r = rot[k] || {};
		return {slot: k, ts: r.ts, size: r.size, filename: r.filename, missing: r.missing, source: "downloads"};
	});
	fbDiscoveredRows(stash, "rotation").forEach(function (d) { rows.push(d); });
	return rows.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
}

// The "Saved" cell: a link to the backup .html if its URL can be built, else the
// plain date. Clicking opens that snapshot. Shared by the rotation + milestone
// tables.
function fbSavedLink(ts, filename) {
	var date = fbFormatTs(ts);
	var url = fbFileUrl(filename);
	return url ? "<a class=\"tc-tiddlylink-external\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + date + "</a>" : date;
}

function fbRotationTable(rows) {
	var out = ["|!Slot|!Saved|!Size|!Source|"];
	rows.forEach(function (e) {
		var size = fbFormatBytes(e.size) + (e.missing ? " //(missing)//" : "");
		var saved = e.filename ? fbSavedLink(e.ts, e.filename) : fbCell(fbNameTimestamp(e.name));
		out.push("|" + fbCell(e.slot || "?") + "|" + saved + "|" + size + "|" + fbSource(e) + "|");
	});
	return out.join("\n");
}

// Download-tracked milestones tagged "downloads"; folder-sync-discovered
// milestone files appended (newest first; discovered ones sort by name-ts = 0).
function fbMilestoneRows(stash) {
	var ms = (stash && Array.isArray(stash.milestones)) ? stash.milestones.map(function (m) { return Object.assign({source: "downloads"}, m); }) : [];
	fbDiscoveredRows(stash, "milestone").forEach(function (d) { ms.push(d); });
	return ms.sort(function (a, b) { return ((b && b.ts) || 0) - ((a && a.ts) || 0); });
}

function fbMilestoneTable(rows) {
	var out = ["|!Saved|!Label|!Description|!Size|!Source|"];
	rows.forEach(function (m) {
		m = m || {};
		var size = fbFormatBytes(m.size) + (m.missing ? " //(missing)//" : "");
		var saved = m.filename ? fbSavedLink(m.ts, m.filename) : fbCell(fbNameTimestamp(m.name));
		out.push("|" + saved + "|" + fbCell(m.label || "") + "|" + fbCell(m.description || "") + "|" + size + "|" + fbSource(m) + "|");
	});
	return out.join("\n");
}

// Estimated total size of a tracked list (rotation slots or milestones). Shown
// as a summary line in each section. "Estimated" because only AddOn-recorded
// backups are summed — the folder may hold more.
function fbRowsTotalBytes(rows) {
	return rows.reduce(function (s, e) { return (e && !e.missing && typeof e.size === "number" && isFinite(e.size)) ? s + e.size : s; }, 0);
}

function fbTotalSizeLine(rows) {
	var missing = rows.filter(function (e) { return e && e.missing; }).length;
	var line = "''Estimated total size:'' " + fbFormatBytes(fbRowsTotalBytes(rows));
	if (missing) line += " //(" + missing + " missing, not counted)//";
	return line;
}

// Full rotation tiddler: intro (folder + shared filename + first tracked save),
// the WHOLE table (newest first), and the generated-at note.
function buildRotationFull(stash, now, ctx) {
	var rows = fbRotationRows(stash);
	var out = ["!! Rotating backups", ""];
	if (ctx) {
		// On a backup file there is no own list — only point back to the main wiki.
		out.push(fbBackupContextNotice(ctx));
		return out.join("\n");
	}
	out.push(fbOpenBackupsButton());
	out.push("");
	if (rows.length) {
		out.push(fbTotalSizeLine(rows));
		out.push("");
		var first = rows.reduce(function (m, e) { return (typeof e.ts === "number" && (m === null || e.ts < m)) ? e.ts : m; }, null);
		out.push("Tower-of-Hanoi rotation in `" + fbDirName(rows[0].filename) + "`. The slots below all share the same wiki-file name (only the ''(A)'' / ''(B)'' / … suffix differs). First tracked save: " + fbFormatTs(first) + ".");
		out.push("");
		out.push(fbRotationTable(rows));
	} else {
		out.push("//No rotating backups tracked yet.//");
	}
	out.push("");
	out.push(fbGeneratedNote(now));
	return out.join("\n");
}

function buildRotationPreview(stash, ctx) {
	if (ctx) return fbBackupContextNotice(ctx);
	var rows = fbRotationRows(stash);
	if (!rows.length) return "//No rotating backups tracked yet.//";
	return fbTotalSizeLine(rows) + "\n\n" + fbRotationTable(rows.slice(0, 5));
}

// Shared content for the two backup surfaces — the startup banner (DOM) and the
// summary notice (wikitext) — so the wording + fields live in ONE place and stay
// in sync. Kind-aware: a milestone shows Label + Description; a rotation slot
// shows its Slot. Values are raw; each surface escapes per its format (wikitext
// fbCell vs DOM textContent) and applies its own emphasis/layout.
function fbBackupNoticeParts(ctx) {
	var kind = (ctx && ctx.kind) || "milestone";
	var e = (ctx && ctx.entry) || {};
	var fields = (kind === "rotation")
		? [{name: "Slot", value: e.slot || "?"}]
		: [{name: "Label", value: e.label || "none"}, {name: "Description", value: e.description || "none"}];
	return {
		lead: (kind === "rotation") ? "You are viewing a rotating backup" : "You are viewing a milestone snapshot",
		rest: " saved " + fbFormatTs(e.ts) + ". It is a read-only point-in-time copy.",
		fields: fields,
		mainWikiUrl: (ctx && ctx.mainWikiUrl) || null,
		linkText: "Open the main wiki",
		linkSuffix: " to keep working."
	};
}

function fbBackupContextNotice(ctx) {
	var p = fbBackupNoticeParts(ctx);
	var link = p.mainWikiUrl
		? "<a class=\"tc-tiddlylink-external\" href=\"" + p.mainWikiUrl + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + p.linkText + "</a>"
		: "the main wiki";
	var line1 = "''" + p.lead + "''" + p.rest + " " + link + p.linkSuffix;
	var line2 = p.fields.map(function (f) { return "''" + f.name + ":'' " + fbCell(f.value); }).join(" &nbsp;·&nbsp; ");
	return "@@background:#fef9c3;padding:0.4em 0.7em;\n" + line1 + "<br>\n" + line2 + "\n@@";
}

function buildMilestonesFull(stash, now, ctx) {
	var rows = fbMilestoneRows(stash);
	var out = ["!! Milestones", ""];
	if (ctx) {
		// On a backup file there is no own list — only point back to the main wiki.
		out.push(fbBackupContextNotice(ctx));
		return out.join("\n");
	}
	out.push(fbOpenBackupsButton());
	out.push("");
	if (rows.length) {
		out.push(fbTotalSizeLine(rows));
		out.push("");
		out.push("Milestone snapshots in `" + fbDirName(rows[0] && rows[0].filename) + "`.");
		out.push("");
		out.push(fbMilestoneTable(rows));
	} else {
		out.push("//No milestones tracked yet.//");
	}
	out.push("");
	out.push(fbGeneratedNote(now));
	return out.join("\n");
}

function buildMilestonesPreview(stash, ctx) {
	if (ctx) return fbBackupContextNotice(ctx);
	var rows = fbMilestoneRows(stash);
	if (!rows.length) return "//No milestones tracked yet.//";
	return fbTotalSizeLine(rows) + "\n\n" + fbMilestoneTable(rows.slice(0, 5));
}

// Find this wiki's tracked data and relay the rendered summary to the bridge as a
// STRING (a primitive crosses the Firefox content<->page boundary cleanly). At
// startup we match this wiki's URL against the file-path keys in storage.local;
// after a save we already hold the exact key (fbWikiPath) and use it directly.
function sendSummary() {
	browser.storage.local.get(null).then(function (all) {
		var box = document.getElementById("tiddlyfox-message-box");
		if (!box) return;
		var stash = null;
		if (fbWikiPath && all[fbWikiPath]) {
			stash = all[fbWikiPath];
		} else {
			var target = fbWikiPathNorm();
			for (var key in all) {
				if (fbNorm(key) === target) { stash = all[key]; break; }
			}
		}
		// If this file is itself a tracked backup (milestone or rotation slot) there's
		// no stash under its own key; recover the main wiki's and pass the context so
		// every summary section becomes a "this is a backup of X" notice + link.
		var bkCtx = fbBackupContext;
		if (!stash && bkCtx && all[bkCtx.mainWikiPath]) {
			stash = all[bkCtx.mainWikiPath];
		}
		var now = Date.now();
		var payload = JSON.stringify({
			rotationFull: buildRotationFull(stash, now, bkCtx),
			rotationPreview: buildRotationPreview(stash, bkCtx),
			milestonesFull: buildMilestonesFull(stash, now, bkCtx),
			milestonesPreview: buildMilestonesPreview(stash, bkCtx),
			backupFolderUrl: fbBackupDirUrl(all.backupdir || "twBackups") || ""
		});
		box.dispatchEvent(new CustomEvent("file-backups-summary", {detail: payload}));
	}).catch(function () {});
}

// The backup folder for THIS wiki: its own directory + backupdir + wiki-file
// name (backups live in a sibling <backupdir>/<wiki.html>/ folder). wikiBase is
// taken straight from the URL (already encoded); backupdir comes from storage
// (raw), so only it is encoded. Trailing slash = a directory URL.
function fbBackupDirUrl(backupdir) {
	var u = fbWikiUrl();
	var lastSlash = u.lastIndexOf("/");
	if (lastSlash < 0) return null;
	var wikiDir = u.slice(0, lastSlash + 1);
	var wikiBase = u.slice(lastSlash + 1);
	if (!wikiBase) return null;
	return wikiDir + encodeURIComponent(backupdir) + "/" + wikiBase + "/";
}

// Result banner for the folder scan (dismissible). Reused for errors too, since
// fetching a file:// directory may be blocked — the message says what happened.
function renderScanNotice(text) {
	var existing = document.getElementById("fb-scan-notice");
	if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
	var box = document.createElement("div");
	box.id = "fb-scan-notice";
	box.style = "position:fixed; left:0; right:0; top:1em; max-width:70%; margin-left:auto; margin-right:auto; padding:8px 12px; background:#dbeafe; border:1px solid #93c5fd; color:#0c0c0d; z-index:10000; font-size:initial; word-break:break-all;";
	var span = document.createElement("span");
	span.textContent = text;
	box.appendChild(span);
	var ok = document.createElement("button");
	ok.textContent = "OK";
	ok.style = "margin-left:10px;";
	ok.addEventListener("click", function () { if (box.parentNode) box.parentNode.removeChild(box); });
	box.appendChild(ok);
	document.body.appendChild(box);
}

// At startup, recognise when the open file is itself a tracked backup — a
// milestone snapshot or a rotation slot. The AddOn records every backup's
// filename, so we match this file's path against them across all wikis
// (findBackupByFile, from backup-tracking). On a hit we show the banner and
// re-send the summary so its sections carry the same notice — all linking back
// to the main wiki.
function detectBackupContext() {
	browser.storage.local.get(null).then(function (all) {
		var hit = (typeof findBackupByFile === "function") ? findBackupByFile(all, fbWikiPathNorm(), fbNorm) : null;
		if (!hit) return;
		fbBackupContext = {
			mainWikiPath: hit.mainWikiPath,
			mainWikiUrl: fbPathToUrl(hit.mainWikiPath),
			kind: hit.kind,
			entry: hit.entry
		};
		renderBackupBanner(fbBackupContext);
		sendSummary();
	}).catch(function () {});
}

// Startup "message box" (an in-page banner, not a modal) shown when the open file
// is a tracked backup (milestone or rotation slot). States it plainly and links
// back to the main wiki via a real anchor (native navigation, no click handler);
// dismissible.
function renderBackupBanner(ctx) {
	var existing = document.getElementById("fb-backup-banner");
	if (existing) existing.parentNode.removeChild(existing);
	if (!ctx) return;
	var p = fbBackupNoticeParts(ctx);
	var box = document.createElement("div");
	box.id = "fb-backup-banner";
	box.style = "position:fixed; left:0; right:0; top:1em; max-width:60%; margin-left:auto; margin-right:auto; padding:10px 14px; background:#fef9c3; border:1px solid #eab308; color:#0c0c0d; z-index:10000; font-size:initial; box-shadow:0 1px 4px rgba(0,0,0,0.15);";

	// Line 1: emphasised lead + note + link (same wording as the summary notice).
	var line1 = document.createElement("div");
	var lead = document.createElement("strong");
	lead.textContent = p.lead;
	line1.appendChild(lead);
	line1.appendChild(document.createTextNode(p.rest + " "));
	if (p.mainWikiUrl) {
		var link = document.createElement("a");
		link.href = p.mainWikiUrl;
		link.textContent = p.linkText;
		link.style = "font-weight:600;";
		line1.appendChild(link);
		line1.appendChild(document.createTextNode(p.linkSuffix));
	}
	box.appendChild(line1);

	// Line 2: the kind's fields (milestone: Label + Description; rotation: Slot).
	var line2 = document.createElement("div");
	line2.style = "margin-top:0.3em;";
	p.fields.forEach(function (f, i) {
		if (i > 0) line2.appendChild(document.createTextNode("  ·  "));
		var name = document.createElement("strong");
		name.textContent = f.name + ": ";
		line2.appendChild(name);
		line2.appendChild(document.createTextNode(f.value));
	});
	box.appendChild(line2);

	var dismiss = document.createElement("button");
	dismiss.textContent = "Dismiss";
	dismiss.style = "margin-top:0.5em;";
	dismiss.addEventListener("click", function () { if (box.parentNode) box.parentNode.removeChild(box); });
	box.appendChild(dismiss);

	document.body.appendChild(box);
}

// Primary action for a reminder. A milestone reminder opens the milestone
// dialog (via the page-context bridge) so the user can enter a Label and
// Description; the reminder clears when a milestone is actually saved (handled
// in the background), NOT on click, since the user may cancel the dialog.
// Count/size reminders open the backup folder so the user can review and clean
// up; those stay until snoozed or until a later save no longer breaches the limit.
function onReminderAction(kind) {
	if (kind === "milestone") {
		var box = document.getElementById("tiddlyfox-message-box");
		if (box) box.dispatchEvent(new CustomEvent("file-backups-open-milestone"));
	} else {
		browser.runtime.sendMessage({msg: "openBackupFolder"}).catch(function () {});
	}
}

// TODO it's ugly .. improve this
function backendMessage(template, color, background) {
	var color = color || "white",
		background = background || "red",
		wrapper  = document.createElement("div");

	wrapper = createDomElements(wrapper, template);

	wrapper.style = `position: fixed; left: 0; top: 0; right: 0; color: ${color}; background: ${background}; border: 4px solid black; text-align: center; margin: 8px; z-index: 10000; font-size: initial;`;
	document.body.appendChild(wrapper);
	wrapper.addEventListener("click", function (event) {
		document.body.removeChild(wrapper);
	}, false);
}

// Show a warning message, if a TW is open 2 times. At the moment, this isn't allowed.
function checkUrlConflict() {
	var data = {};

	data.url = document.URL,
	data.msg = "checkUrlConflict";

	var getStat = browser.runtime.sendMessage(data)

	getStat.then( (urlConflict) => {
		let tabExistsMessage = [
			{
				tag: "p",
				attr: [{ name: "style", value: "font-weight: 600;"}
					  ],
				children: [
					{ text: "Message from 'file-backups' AddOn:" }
				]
			},
			{ tag: "p",
				children: [
					{ text: "This TiddlyWiki file is already open in another tab OR an other window!"}
				]
			},
			{ text: data.url }
		];

		if (urlConflict) {
			// backendMessage(template, color::string, background::string)
			backendMessage(tabExistsMessage);
		}
	});
}

// Can be found at: https://classic.TiddlyWiki.com
function isTiddlyWikiClassicFile(doc) {
	// Test whether the document is a TiddlyWiki (we don't have access to JS objects in it)
	var versionArea = doc.getElementById("versionArea");
	return (doc.location.protocol === "file:") &&
		doc.getElementById("storeArea") &&
		(versionArea && /TiddlyWiki/.test(versionArea.text));
}

// Can be found at: https://TiddlyWiki.com
function isTiddlyWiki5File(doc) {
	// Test whether the document is a TiddlyWiki. Check the meta info, which is new in TW5
	var meta = document.getElementsByTagName("META");
	if (meta) {
		for (let i = 0; i < meta.length; i++) {
			if (meta[i].content === "TiddlyWiki") return true;
		}
	}
	return false;
}

function injectPageScript(doc, resourcePath) {
	var s = document.createElement('script');
	s.src = browser.runtime.getURL(resourcePath);
	(doc.head || doc.documentElement).appendChild(s);
	s.onload = function () {
		s.parentNode.removeChild(s);
	};
}

// main loop
function injectMessageBox(doc) {
	// check, if we are TWclassic!!
	if (isTiddlyWikiClassicFile(doc)) {
		injectPageScript(doc, 'classic/inject.js');
	}

	// Inject the message box
	var messageBox = doc.getElementById("tiddlyfox-message-box");
	if (messageBox) {
		var othersw = messageBox.getAttribute("data-message-box-creator") || null;
		if (othersw !== PLUGIN_NAME) {
			alert('"' + PLUGIN_NAME + '" has detected another plugin named: "' + othersw + '"\n' +
				'At the moment only 1 save mechanism can be active at once.\n' +
				'We will temporarily deactivate the functionality, until the problem is resolved!');
			return;
		} else {
			messageBox.setAttribute("data-message-box-creator", PLUGIN_NAME);
		}
	} else {
		messageBox = doc.createElement("div");
		messageBox.id = "tiddlyfox-message-box";
		messageBox.style.display = "none";
		messageBox.setAttribute("data-message-box-creator", PLUGIN_NAME);
		doc.body.appendChild(messageBox);
	}
	// Attach the event handler to the message box
	messageBox.addEventListener("tiddlyfox-save-file", function (event) {
		var path;
		// Get the details from the message
		var message = event.target,
			subdir = message.parentNode.getAttribute("data-tiddlyfox-subdir"), // <-- see parentNode
			saveas = message.parentNode.getAttribute("data-tiddlyfox-saveas"), // <-- see parentNode
			path = message.getAttribute("data-tiddlyfox-path"),
			content = message.getAttribute("data-tiddlyfox-content"),
			backupdir = message.getAttribute("data-tiddlyfox-backupdir"),
			milestone = message.parentNode.getAttribute("data-file-backups-milestone") === "yes",
			milestoneLabel = message.parentNode.getAttribute("data-file-backups-milestone-label"),
			milestoneTs = message.parentNode.getAttribute("data-file-backups-milestone-ts"),
			milestoneDescription = message.parentNode.getAttribute("data-file-backups-milestone-description");

		// Per-wiki backup-awareness overrides the bridge attached (phase 3).
		// Empty / absent attribute = inherit the global default; numbers only.
		var overrides = {};
		var ovrRemind = message.parentNode.getAttribute("data-fb-remind");
		var ovrCount = message.parentNode.getAttribute("data-fb-count");
		var ovrSize = message.parentNode.getAttribute("data-fb-size");
		if (ovrRemind) overrides.remindAfterDays = Number(ovrRemind);
		if (ovrCount) overrides.fileCountLimit = Number(ovrCount);
		if (ovrSize) overrides.sizeLimitMB = Number(ovrSize);

		// Remember which wiki this is so a later Snooze can target it, and so the
		// summary can use the exact storage key (phase 3).
		fbWikiPath = path;

		// Save the file
		saveFile(path, content, subdir, backupdir, saveas, milestone, milestoneLabel, milestoneTs, milestoneDescription, overrides, cb);

		// using it that way, allows us to establishe a 2 way communication between
		// bg and tiddlyFox saver, within TW, in a backwards compatible way.
		function cb(response) {
			// Send a confirmation message
			if (response.relPath === "") {
				if (response.beakonError) {
					// TODO
				} else if (response.downloadWikiError) {
					// TODO
				} else if (response.openNewTabError) {
					let fName = (response.openNewTabInfo && response.openNewTabInfo.filename) ? response.openNewTabInfo.filename : "response.openNewTabInfo: no filename defined!"
					let tabCreateMessage = [
							{
								tag: "p",
								attr: { name: "style", value: "font-weight: 600;"},
								children: [
									{ text: response.openNewTabError }
								]
							},
							{
								tag: "p",
								children: [
									{ tag: "a",
									  attr: [
										  {name: "href", value: fName},
										  {name: "class", value: "tc-tiddlylink-external"},
										  {name: "rel", value: "noopener noreferrer"},
										  {name: "target", value: "_blank"}
										],
										children: [
											{ text: "Click -> " },
											{ text: fName}
										]
									}
								]
							}
						];
					// backendMessage(template, color, background)
					backendMessage(tabCreateMessage, "black", "lightgreen");
				} // else if(response.openNewTabError)
			} else {
				message.parentNode.setAttribute("data-tiddlyfox-saveas", "no");
			} // if (response.relPath === "")

			// Backup-awareness reminders evaluated for this save (phase 3).
			if (response && response.reminders) {
				fbReminders = response.reminders;
				renderReminderBanners();
			}

			// Refresh the injected backup-summary tiddler with this save's data.
			sendSummary();

			message.parentNode.setAttribute("data-tiddlyfox-subdir", response.subdir || "");
			message.dispatchEvent(new CustomEvent("tiddlyfox-have-saved-file", {bubbles: true}));

			// Remove element from the message box, to reduce DOM size
			message.parentNode.removeChild(message);
		}
		return false;
	}, false);

	// Dev test affordance (beta-only). The bridge dispatches this CustomEvent
	// when the user clicks a Test button in CP > Settings > FileBackups; we
	// forward to background which writes the fake updateAvailable into
	// storage.local. Stable builds don't ship the CP test buttons, so the
	// event never fires there; the listener is harmless either way.
	messageBox.addEventListener("file-backups-test-inject", function (e) {
		var kind = e && e.detail && e.detail.kind;
		if (kind !== "stable" && kind !== "beta") return;
		browser.runtime.sendMessage({msg: "testInjectUpdate", kind: kind})
			.catch(function () {});
	}, false);

	// Dev test affordance (beta builds only): forward the awareness-defaults
	// test injection to the background, which writes sample/zeroed global limits
	// to storage.local. Reading e.detail here is safe (page -> content script:
	// content scripts get Xray access to page objects).
	messageBox.addEventListener("file-backups-test-inject-awareness", function (e) {
		var kind = e && e.detail && e.detail.kind;
		if (kind !== "sample" && kind !== "off") return;
		browser.runtime.sendMessage({msg: "testInjectAwareness", kind: kind})
			.catch(function () {});
	}, false);

	// Dev test affordance (beta builds only): render a sample reminder banner
	// directly, without a save, so the surface can be exercised. The real banner
	// is driven by the save response; this just sets the local display state. A
	// test-injected reminder has no wiki path, so its Snooze only hides locally.
	messageBox.addEventListener("file-backups-test-inject-reminder", function (e) {
		var kind = e && e.detail && e.detail.kind;
		if (kind === "clear") {
			fbReminders = {milestone: null, count: null, size: null};
			renderReminderBanners();
			// Also clear any persisted per-wiki snooze so a snoozed reminder can fire
			// again on the next save (e.g. when a prior test Snooze stuck). Find this
			// wiki's storage key the same way the summary does.
			browser.storage.local.get(null).then(function (all) {
				var key = null;
				if (fbWikiPath && all[fbWikiPath]) key = fbWikiPath;
				else {
					var t = fbWikiPathNorm();
					for (var k in all) { if (fbNorm(k) === t) { key = k; break; } }
				}
				if (key) browser.runtime.sendMessage({msg: "clearSnoozes", path: key}).catch(function () {});
			}).catch(function () {});
			return;
		}
		if (kind !== "milestone" && kind !== "count" && kind !== "size") return;
		var SAMPLE = {milestone: 14, count: 30, size: 100};
		fbReminders[kind] = SAMPLE[kind];
		renderReminderBanners();
	}, false);

	// Relay the global backup-awareness defaults into the wiki so the CP can
	// show what an empty per-wiki override field inherits. The page-context
	// bridge can't read storage.local; this content script can. We answer the
	// bridge's one-shot request on startup and re-push whenever the options
	// change, so the displayed defaults stay live without a reload.
	function sendGlobalPrefs() {
		browser.storage.local.get({
			defaultRemindMilestoneAfterDays: 0,
			defaultFileCountLimit: 0,
			defaultSizeLimitMB: 0
		}).then(function (prefs) {
			// Pass a JSON STRING, not the object. The page-context bridge lives in
			// a separate Firefox compartment and is denied access to the properties
			// of an object created here in the content script ("Permission denied to
			// access property ..."). A primitive string crosses the boundary cleanly;
			// the bridge JSON.parses it.
			messageBox.dispatchEvent(new CustomEvent("file-backups-global-prefs", {detail: JSON.stringify(prefs)}));
		}).catch(function () {});
	}
	messageBox.addEventListener("file-backups-request-global-prefs", sendGlobalPrefs, false);
	browser.storage.onChanged.addListener(function (changes, area) {
		if (area !== "local") return;
		if (changes.defaultRemindMilestoneAfterDays ||
			changes.defaultFileCountLimit ||
			changes.defaultSizeLimitMB) {
			sendGlobalPrefs();
		}
	});

	// Backup summary: the bridge asks for it on install; we build it from the
	// tracked data and send it back for injection (also refreshed after a save).
	messageBox.addEventListener("file-backups-request-summary", sendSummary, false);

	// The rotation summary tiddler's "Open backups folder" button is a TW
	// <$button> sending the widget message tm-file-backups-show-backups. The
	// page-context bridge catches it on $tw.rootWidget and dispatches this DOM
	// event on the messagebox; we forward it to the background openBackupFolder
	// handler — only the extension context can open the OS file manager
	// (downloads.show) — the same action the reminder banner's "Show backups" uses.
	messageBox.addEventListener("file-backups-show-backups", function () {
		browser.runtime.sendMessage({msg: "openBackupFolder"}).catch(function () {});
	}, false);

	// Inject the TW5 page-context bridge now that the messagebox and our save
	// listener are in place. The bridge attaches a capture-phase listener on
	// the same element so it runs before the one above.
	if (isTiddlyWiki5File(doc)) {
		injectPageScript(doc, 'tw5-bridge.js');
	}

	// Recognise (at startup) whether this open file is a tracked backup (milestone
	// or rotation slot) and, if so, greet the user with a banner linking to the
	// main wiki.
	detectBackupContext();
}

function saveFile(filePath, content, subdir, backupdir, saveas, milestone, milestoneLabel, milestoneTs, milestoneDescription, overrides, cb) {
	let msg = {},
		stat;

	// Save the file
	try {
		msg.msg = "save-wiki";
		msg.path = filePath;
		msg.subdir = subdir;
		msg.saveas = saveas;
		msg.backupdir = backupdir;
		msg.txt = content;
		msg.milestone = milestone;
		msg.milestoneLabel = milestoneLabel;
		msg.milestoneTs = milestoneTs;
		msg.milestoneDescription = milestoneDescription;
		msg.overrides = overrides;

		stat = browser.runtime.sendMessage(msg)

		stat.then((bgResponse) => {
			cb(bgResponse);
		}, (err) => {
			console.log("save-wiki error:", err)
		});
		return true;
	} catch (ex) {
		alert(ex);
		return false;
	}
}
