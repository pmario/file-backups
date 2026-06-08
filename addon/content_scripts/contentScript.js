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

// This wiki's location WITHOUT the #fragment — TiddlyWiki rewrites the fragment
// as you navigate, so it must not be part of any key comparison.
function fbWikiUrl() {
	return (document.URL || "").split("#")[0];
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
function main() {
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
		browser.runtime.sendMessage({msg: "snoozeReminder", kind: kind, path: fbWikiPath}).catch(function () {});
	}
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

// Rotation entries (newest first) and their table — shared by the full tiddler
// and the latest-5 CP preview.
function fbRotationRows(stash) {
	var rot = (stash && stash.rotation && typeof stash.rotation === "object" && !Array.isArray(stash.rotation)) ? stash.rotation : {};
	return Object.keys(rot).map(function (k) {
		var r = rot[k] || {};
		return {slot: k, ts: r.ts, size: r.size, filename: r.filename};
	}).sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
}

function fbRotationTable(rows) {
	var out = ["|!Slot|!Saved|!Size|"];
	rows.forEach(function (e) {
		out.push("|" + fbCell(e.slot) + "|" + fbFormatTs(e.ts) + "|" + fbFormatBytes(e.size) + "|");
	});
	return out.join("\n");
}

function fbMilestoneRows(stash) {
	var ms = (stash && Array.isArray(stash.milestones)) ? stash.milestones.slice() : [];
	return ms.sort(function (a, b) { return ((b && b.ts) || 0) - ((a && a.ts) || 0); });
}

function fbMilestoneTable(rows) {
	var out = ["|!Saved|!Label|!Description|!Size|"];
	rows.forEach(function (m) {
		m = m || {};
		var date = fbFormatTs(m.ts);
		var url = fbFileUrl(m.filename);
		// Clicking the date opens that milestone .html (a standalone wiki snapshot).
		var saved = url ? "<a class=\"tc-tiddlylink-external\" href=\"" + url + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + date + "</a>" : date;
		out.push("|" + saved + "|" + fbCell(m.label || "") + "|" + fbCell(m.description || "") + "|" + fbFormatBytes(m.size) + "|");
	});
	return out.join("\n");
}

// Full rotation tiddler: intro (folder + shared filename + first tracked save),
// the WHOLE table (newest first), and the generated-at note.
function buildRotationFull(stash, now) {
	var rows = fbRotationRows(stash);
	var out = ["!! Rotating backups", ""];
	if (rows.length) {
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

function buildRotationPreview(stash) {
	var rows = fbRotationRows(stash);
	return rows.length ? fbRotationTable(rows.slice(0, 5)) : "//No rotating backups tracked yet.//";
}

// Full milestones tiddler: filename folder once, the WHOLE table (newest first,
// Label + Description prominent), and the generated-at note.
function buildMilestonesFull(stash, now) {
	var rows = fbMilestoneRows(stash);
	var out = ["!! Milestones", ""];
	if (rows.length) {
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

function buildMilestonesPreview(stash) {
	var rows = fbMilestoneRows(stash);
	return rows.length ? fbMilestoneTable(rows.slice(0, 5)) : "//No milestones tracked yet.//";
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
		var now = Date.now();
		var payload = JSON.stringify({
			rotationFull: buildRotationFull(stash, now),
			rotationPreview: buildRotationPreview(stash),
			milestonesFull: buildMilestonesFull(stash, now),
			milestonesPreview: buildMilestonesPreview(stash)
		});
		box.dispatchEvent(new CustomEvent("file-backups-summary", {detail: payload}));
	}).catch(function () {});
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

	// Inject the TW5 page-context bridge now that the messagebox and our save
	// listener are in place. The bridge attaches a capture-phase listener on
	// the same element so it runs before the one above.
	if (isTiddlyWiki5File(doc)) {
		injectPageScript(doc, 'tw5-bridge.js');
	}
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
