/*
 * classic/milestone.js — "Save a Milestone Snapshot" for TiddlyWiki Classic.
 *
 * Injected into TW Classic pages (next to classic/inject.js) by the content
 * script. Runs in the page's JavaScript context so it can reach config, store,
 * story, saveChanges, ... It mirrors the TW5 milestone modal:
 *
 *   - entry points: <<fileBackupsMilestone>> button after <<saveChanges>> in
 *     the SideBarOptions shadow, a "milestone" backstage task (works even when
 *     the user has customised SideBarOptions) and the Alt+M shortcut.
 *   - modal: label (optional, max 40 chars, used in the filename), one-line
 *     description, [Save milestone], last 5 milestones.
 *   - entries are stored in the "Milestones" tiddler, one "ts: value" line
 *     per milestone — the same format as the TW5 $:/milestones dictionary.
 *     ("$:/" marks system tiddlers only in TW5; Classic has no such prefix.)
 *   - Save: record the entry, arm the pending milestone and call
 *     saveChanges(false). classic/inject.js takes the pending milestone in its
 *     mozillaSaveFile override and sets the data-file-backups-milestone*
 *     attributes on the message box, exactly like tw5-bridge.js does for TW5.
 *     The content script + background (createMilestoneFile) are shared.
 *
 * The pure helpers at the top are exported for Node unit tests
 * (test/classic-milestone.test.js); the UI part only runs in a browser.
 */

(function (root) {
	"use strict";

	var MILESTONES_TITLE = "Milestones";
	var LABEL_MAX = 40;
	var RECENT_COUNT = 5;
	// A pending milestone is consumed by the next save. If that save never
	// reaches mozillaSaveFile (error, user cancelled), drop it after this long
	// so it can't attach itself to an unrelated later save.
	var PENDING_TTL_MS = 60 * 1000;

	function pad2(n) {
		return (n < 10 ? "0" : "") + n;
	}

	// Local time, same shape as TW5's <<now "YYYY-0MM-0DD-0hh-0mm-0ss">>.
	function formatTimestamp(date) {
		return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) +
			"-" + pad2(date.getHours()) + "-" + pad2(date.getMinutes()) + "-" + pad2(date.getSeconds());
	}

	function clampLabel(label) {
		return String(label || "").trim().slice(0, LABEL_MAX);
	}

	// "label - description", leaving out empty parts.
	function historyValue(label, description) {
		return [String(label || "").trim(), String(description || "").trim()]
			.filter(function (s) { return s.length > 0; })
			.join(" - ");
	}

	// "key: value" lines (TW5 application/x-tiddler-dictionary).
	function parseDictionary(text) {
		var entries = [];
		String(text || "").split(/\r?\n/).forEach(function (line) {
			var p = line.indexOf(":");
			if (p <= 0) return;
			var key = line.slice(0, p).trim();
			if (!key) return;
			entries.push({ts: key, value: line.slice(p + 1).trim()});
		});
		return entries;
	}

	function stringifyDictionary(entries) {
		return entries.map(function (e) { return e.ts + ": " + e.value; }).join("\n");
	}

	// Add or replace the entry for ts; entries stay sorted oldest → newest.
	function addEntry(text, ts, value) {
		var entries = parseDictionary(text).filter(function (e) { return e.ts !== ts; });
		entries.push({ts: ts, value: value});
		entries.sort(function (a, b) { return a.ts < b.ts ? -1 : (a.ts > b.ts ? 1 : 0); });
		return stringifyDictionary(entries);
	}

	// Newest first, at most n.
	function recentEntries(text, n) {
		return parseDictionary(text)
			.sort(function (a, b) { return a.ts < b.ts ? 1 : (a.ts > b.ts ? -1 : 0); })
			.slice(0, n);
	}

	var helpers = {
		MILESTONES_TITLE: MILESTONES_TITLE,
		LABEL_MAX: LABEL_MAX,
		formatTimestamp: formatTimestamp,
		clampLabel: clampLabel,
		historyValue: historyValue,
		parseDictionary: parseDictionary,
		addEntry: addEntry,
		recentEntries: recentEntries
	};

	// Node (unit tests): export the helpers, skip the UI.
	if (typeof module !== "undefined" && module.exports) {
		module.exports = helpers;
		return;
	}

	// Only in a TW Classic page, and only once per page. After an extension
	// reload the content script re-injects us; the earlier instance keeps
	// working (it only talks to the page and the message box).
	if (typeof root.config === "undefined" || !root.config.macros || typeof root.saveChanges !== "function") {
		return;
	}
	if (root.__fileBackupsClassicMilestone) {
		return;
	}

	var pending = null;

	// Called by classic/inject.js for every save; returns the pending
	// milestone once, or null.
	function takePendingMilestone() {
		var p = pending;
		pending = null;
		if (!p || Date.now() - p.armedAt > PENDING_TTL_MS) return null;
		return {label: p.label, ts: p.ts, description: p.description || ""};
	}

	root.__fileBackupsClassicMilestone = {
		helpers: helpers,
		takePendingMilestone: takePendingMilestone,
		open: openModal
	};

	// --- palette -----------------------------------------------------------

	function paletteColor(name, fallback) {
		try {
			var v = root.store && root.store.getTiddlerSlice("ColorPalette", name);
			if (v) return v;
		} catch (err) {}
		return fallback;
	}

	function injectStyles() {
		if (document.getElementById("fb-classic-milestone-style")) return;
		var bg = paletteColor("Background", "#fff");
		var fg = paletteColor("Foreground", "#000");
		var pale = paletteColor("PrimaryPale", "#8cf");
		var light = paletteColor("PrimaryLight", "#18f");
		var mid = paletteColor("PrimaryMid", "#04b");
		var tertiary = paletteColor("TertiaryLight", "#ccc");
		var alert = paletteColor("SecondaryLight", "#fe8");
		var error = paletteColor("Error", "#f88");
		var css = [
			".fb-ms-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:10000;display:flex;align-items:flex-start;justify-content:center;padding-top:10vh;}",
			".fb-ms-dialog{background:" + bg + ";color:" + fg + ";border:1px solid " + tertiary + ";border-radius:4px;box-shadow:0 4px 24px rgba(0,0,0,.3);width:min(32em,calc(100vw - 32px));max-height:80vh;overflow:auto;font-size:1.1em;}",
			".fb-ms-header{background:" + mid + ";color:" + bg + ";padding:.5em .8em;display:flex;align-items:baseline;gap:.6em;}",
			".fb-ms-header h2{margin:0;padding:0;border:0;font-size:1.15em;color:inherit;background:none;flex:1;}",
			".fb-ms-header .fb-ms-date{font-size:.85em;opacity:.85;}",
			".fb-ms-close{background:none;border:0;color:inherit;font-size:1.3em;line-height:1;cursor:pointer;padding:0 .2em;}",
			".fb-ms-body{padding:.6em .8em .8em;}",
			".fb-ms-grid{display:grid;grid-template-columns:max-content 1fr;gap:.4em .8em;align-items:center;margin:.4em 0 .8em;}",
			".fb-ms-grid input{width:100%;box-sizing:border-box;font:inherit;padding:.2em .3em;}",
			".fb-ms-warning{display:block;color:" + error + ";font-size:.85em;margin-top:.2em;}",
			".fb-ms-warning:empty{display:none;}",
			".fb-ms-actions a.button{display:inline-block;padding:.2em .8em;border:1px solid " + light + ";background:" + pale + ";color:" + fg + ";}",
			".fb-ms-actions a.button:hover{background:" + light + ";color:" + bg + ";}",
			".fb-ms-recent h3{font-size:1em;margin:1em 0 .3em;padding:0;border:0;}",
			".fb-ms-recent ul{margin:0;padding-left:1.4em;}",
			".fb-ms-recent li.fb-ms-empty{list-style:none;margin-left:-1.4em;font-style:italic;}",
			"@keyframes fb-ms-flash{0%,100%{background-color:transparent;}50%{background-color:" + alert + ";}}",
			".fb-ms-recent li.fb-ms-flash{animation:fb-ms-flash .5s ease-in-out 3;}"
		].join("\n");
		var style = document.createElement("style");
		style.id = "fb-classic-milestone-style";
		style.textContent = css;
		(document.head || document.documentElement).appendChild(style);
	}

	// --- store -------------------------------------------------------------

	function readMilestones() {
		var t = root.store.getTiddler(MILESTONES_TITLE);
		return t ? t.text : "";
	}

	function writeMilestone(ts, value) {
		var store = root.store;
		var existing = store.getTiddler(MILESTONES_TITLE);
		var text = addEntry(existing ? existing.text : "", ts, value);
		// Hidden from the timeline / All lists, but findable via search.
		var tags = existing ? existing.tags : ["excludeLists"];
		var fields = existing ? existing.fields : {origin: "file-backups AddOn"};
		var modifier = (root.config.options && root.config.options.txtUserName) || "";
		store.saveTiddler(MILESTONES_TITLE, MILESTONES_TITLE, text, modifier, new Date(), tags, fields);
	}

	// --- modal -------------------------------------------------------------

	var overlay = null;

	function closeModal() {
		if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
		overlay = null;
	}

	function renderRecent(listNode, flashTs) {
		while (listNode.firstChild) listNode.removeChild(listNode.firstChild);
		var entries = recentEntries(readMilestones(), RECENT_COUNT);
		if (entries.length === 0) {
			var empty = document.createElement("li");
			empty.className = "fb-ms-empty";
			empty.textContent = "No milestones yet";
			listNode.appendChild(empty);
			return;
		}
		entries.forEach(function (e) {
			var li = document.createElement("li");
			li.textContent = e.ts + (e.value ? ": " + e.value : "");
			if (e.ts === flashTs) li.className = "fb-ms-flash";
			listNode.appendChild(li);
		});
	}

	function openModal() {
		if (overlay) return;
		injectStyles();

		overlay = document.createElement("div");
		overlay.className = "fb-ms-overlay";
		overlay.addEventListener("mousedown", function (e) {
			if (e.target === overlay) closeModal();
		});

		var dialog = document.createElement("div");
		dialog.className = "fb-ms-dialog";
		dialog.setAttribute("role", "dialog");
		dialog.setAttribute("aria-modal", "true");
		dialog.setAttribute("aria-labelledby", "fb-ms-title");
		overlay.appendChild(dialog);

		var header = document.createElement("div");
		header.className = "fb-ms-header";
		var h2 = document.createElement("h2");
		h2.id = "fb-ms-title";
		h2.textContent = "Save a Milestone Snapshot";
		var date = document.createElement("span");
		date.className = "fb-ms-date";
		date.textContent = formatTimestamp(new Date()).replace(/^(\d+-\d+-\d+)-(\d+)-(\d+)-(\d+)$/, "$1 $2:$3:$4");
		var close = document.createElement("button");
		close.type = "button";
		close.className = "fb-ms-close";
		close.setAttribute("aria-label", "Close");
		close.textContent = "×";
		close.addEventListener("click", closeModal);
		header.appendChild(h2);
		header.appendChild(date);
		header.appendChild(close);
		dialog.appendChild(header);

		var body = document.createElement("div");
		body.className = "fb-ms-body";
		dialog.appendChild(body);

		var grid = document.createElement("div");
		grid.className = "fb-ms-grid";
		body.appendChild(grid);

		var labelLbl = document.createElement("label");
		labelLbl.textContent = "Label:";
		labelLbl.htmlFor = "fb-ms-label";
		var labelCell = document.createElement("div");
		var labelInput = document.createElement("input");
		labelInput.type = "text";
		labelInput.id = "fb-ms-label";
		labelInput.placeholder = "optional, used in filename";
		var labelWarn = document.createElement("span");
		labelWarn.className = "fb-ms-warning";
		labelInput.addEventListener("input", function () {
			labelWarn.textContent = labelInput.value.trim().length > LABEL_MAX ? "Limit " + LABEL_MAX + " characters" : "";
		});
		labelCell.appendChild(labelInput);
		labelCell.appendChild(labelWarn);

		var descLbl = document.createElement("label");
		descLbl.textContent = "Description:";
		descLbl.htmlFor = "fb-ms-desc";
		var descInput = document.createElement("input");
		descInput.type = "text";
		descInput.id = "fb-ms-desc";
		descInput.placeholder = "one-line description";

		grid.appendChild(labelLbl);
		grid.appendChild(labelCell);
		grid.appendChild(descLbl);
		grid.appendChild(descInput);

		var actions = document.createElement("div");
		actions.className = "fb-ms-actions";
		body.appendChild(actions);

		var recent = document.createElement("div");
		recent.className = "fb-ms-recent";
		var h3 = document.createElement("h3");
		var allLink = document.createElement("a");
		allLink.href = "#";
		allLink.textContent = "Last " + RECENT_COUNT + " milestones";
		allLink.title = "Open " + MILESTONES_TITLE;
		allLink.addEventListener("click", function (e) {
			e.preventDefault();
			closeModal();
			if (root.store.tiddlerExists(MILESTONES_TITLE)) {
				root.story.displayTiddler(null, MILESTONES_TITLE);
			}
		});
		h3.appendChild(allLink);
		h3.appendChild(document.createTextNode(" \u00b7 "));
		var overviewLink = document.createElement("a");
		overviewLink.href = "#";
		overviewLink.textContent = "Backups overview \u00bb";
		overviewLink.title = "Open " + OVERVIEW_TITLE;
		overviewLink.addEventListener("click", function (e) {
			e.preventDefault();
			closeModal();
			root.story.displayTiddler(null, OVERVIEW_TITLE);
		});
		h3.appendChild(overviewLink);
		var list = document.createElement("ul");
		recent.appendChild(h3);
		recent.appendChild(list);
		body.appendChild(recent);
		renderRecent(list, null);

		function save() {
			var ts = formatTimestamp(new Date());
			var label = clampLabel(labelInput.value);
			var value = historyValue(label, descInput.value);
			try {
				writeMilestone(ts, value);
			} catch (err) {
				root.alert("file-backups: could not record the milestone: " + err);
				return;
			}
			pending = {label: label, ts: ts, description: String(descInput.value || "").trim(), armedAt: Date.now()};
			root.saveChanges(false);
			if (typeof root.displayMessage === "function") {
				root.displayMessage("Milestone saved: " + ts + (label ? " (" + label + ")" : ""));
			}
			labelInput.value = "";
			descInput.value = "";
			labelWarn.textContent = "";
			renderRecent(list, ts);
			labelInput.focus();
		}

		// TW Classic's own button style (a.button), like <<saveChanges>>.
		var saveBtn = document.createElement("a");
		saveBtn.href = "#";
		saveBtn.className = "button";
		saveBtn.textContent = "Save milestone";
		saveBtn.addEventListener("click", function (e) {
			e.preventDefault();
			save();
		});
		actions.appendChild(saveBtn);

		dialog.addEventListener("keydown", function (e) {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				closeModal();
			} else if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") {
				e.preventDefault();
				e.stopPropagation();
				save();
			}
		});

		document.body.appendChild(overlay);
		labelInput.focus();
	}

	// --- backup overview + reminder settings (FileBackups tiddler) ---------
	//
	// The content script sends the same backup summary it sends TW5 (as a
	// JSON string; data = plain rows) and the global reminder defaults. We keep
	// the latest copies and render them with <<fileBackupsSummary>> in the
	// FileBackups shadow tiddler. The per-wiki overrides live in the
	// FileBackupsConfig tiddler (slices), read by classic/inject.js on save.

	var OVERVIEW_TITLE = "FileBackups";
	var CONFIG_TITLE = "FileBackupsConfig";
	var summary = null;      // {data, backupFolderUrl}
	var globalPrefs = null;  // {defaultRemindMilestoneAfterDays, defaultFileCountLimit, defaultSizeLimitMB}

	function messageBox() {
		return document.getElementById("tiddlyfox-message-box");
	}

	function refreshOverview() {
		try {
			if (root.story && root.story.getTiddler(OVERVIEW_TITLE)) root.story.refreshTiddler(OVERVIEW_TITLE, null, true);
		} catch (err) {}
	}

	function parseDetail(e) {
		try { return JSON.parse((e && e.detail) || "null"); } catch (err) { return null; }
	}

	// The content script dispatches these on the message box without bubbling;
	// listening in the capture phase on document catches them anyway, and works
	// no matter whether the message box exists yet.
	document.addEventListener("file-backups-summary", function (e) {
		var d = parseDetail(e);
		if (d) { summary = d; refreshOverview(); }
	}, true);
	document.addEventListener("file-backups-global-prefs", function (e) {
		var d = parseDetail(e);
		if (d) { globalPrefs = d; refreshOverview(); }
	}, true);
	// The reminder box's "Save milestone" button.
	document.addEventListener("file-backups-open-milestone", function () {
		openModal();
	}, true);

	// Ask for both once the content script's message box is there.
	(function requestData(tries) {
		var box = messageBox();
		if (!box) {
			if (tries < 50) setTimeout(function () { requestData(tries + 1); }, 100);
			return;
		}
		box.dispatchEvent(new CustomEvent("file-backups-request-summary"));
		box.dispatchEvent(new CustomEvent("file-backups-request-global-prefs"));
	})(0);

	function el(parent, tag, text, className) {
		var e = document.createElement(tag);
		if (className) e.className = className;
		if (text != null) e.textContent = text;
		if (parent) parent.appendChild(e);
		return e;
	}

	function fileLink(parent, text, url) {
		if (!url) return el(parent, "span", text);
		var a = el(parent, "a", text, "externalLink");
		a.href = url;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		return a;
	}

	function table(parent, headers, rows, cells) {
		var t = el(parent, "table", null, "twtable");
		var tr = el(el(t, "thead"), "tr");
		headers.forEach(function (h) { el(tr, "th", h); });
		var tb = el(t, "tbody");
		rows.forEach(function (r, i) {
			var row = el(tb, "tr", null, i % 2 ? "evenRow" : "oddRow");
			cells(r).forEach(function (c) {
				var td = el(row, "td");
				if (typeof c === "function") c(td); else td.textContent = c;
			});
		});
		return t;
	}

	function sizeText(r) {
		return r.size + (r.missing ? " (missing)" : "");
	}

	function renderOverview(place) {
		var wrap = el(place, "div", null, "fbOverview");
		var data = summary && summary.data;

		el(wrap, "h2", "Rotating backups");
		if (!data || !data.tracked) {
			el(wrap, "p", "No save record for this wiki yet. Save the wiki once (or wait a moment after loading).");
		} else if (!data.rotation.length) {
			el(wrap, "p", "No rotating backups recorded yet.");
		} else {
			el(wrap, "p", "Estimated total size: " + data.rotationTotal);
			table(wrap, ["Slot", "Saved", "Size", "Source"], data.rotation, function (r) {
				return [r.slot || "?", function (td) { fileLink(td, r.saved, r.url); }, sizeText(r), r.source];
			});
		}

		el(wrap, "h2", "Milestones");
		if (data && data.tracked && data.milestones.length) {
			el(wrap, "p", "Estimated total size: " + data.milestonesTotal);
			table(wrap, ["Saved", "Label", "Description", "Size", "Source"], data.milestones, function (r) {
				return [function (td) { fileLink(td, r.saved, r.url); }, r.label, r.description, sizeText(r), r.source];
			});
		} else if (data && data.tracked) {
			el(wrap, "p", "No milestones recorded yet.");
		}

		el(wrap, "h2", "Backup folder");
		var actions = el(wrap, "p");
		root.createTiddlyButton(actions, "Open backups folder", "Show this wiki's backup folder in the file manager", function () {
			var box = messageBox();
			if (box) box.dispatchEvent(new CustomEvent("file-backups-show-backups"));
			return false;
		});
		if (summary && summary.backupFolderUrl) {
			el(actions, "span", " ");
			fileLink(actions, "Open & sync this wiki's backup folder »", summary.backupFolderUrl);
			el(wrap, "p", "Syncing compares the folder with the AddOn's records: files that are gone are marked missing, and backups the AddOn doesn't know yet are added.");
		}

		el(wrap, "h2", "Reminders");
		el(wrap, "p", "Reminders are off by default. They are checked after each save. Set a value in " + CONFIG_TITLE + " to override the global default for this wiki; leave it empty to use the default, 0 turns it off for this wiki.");
		var g = globalPrefs || {};
		var reminders = [
			["No milestone for this many days", "remindAfterDays", g.defaultRemindMilestoneAfterDays, "days"],
			["Backup folder holds more than this many files", "fileCountLimit", g.defaultFileCountLimit, "files"],
			["Backups use more than this much disk space", "sizeLimitMB", g.defaultSizeLimitMB, "MB"]
		];
		table(wrap, ["Reminder", "This wiki", "Global default"], reminders, function (r) {
			var own = String(root.store.getTiddlerSlice(CONFIG_TITLE, r[1]) || "").trim();
			var off = function (v) { return (!v || v === "0") ? "off" : v + " " + (v === "1" ? r[3].replace(/s$/, "") : r[3]); };
			return [r[0], own === "" ? "(default)" : off(own), globalPrefs ? off(String(r[2] || 0)) : "?"];
		});
		var cfg = el(wrap, "p");
		root.createTiddlyLink(cfg, CONFIG_TITLE, true);
	}

	root.config.macros.fileBackupsSummary = {
		handler: function (place) {
			renderOverview(place);
		}
	};

	var shadowTexts = root.config.shadowTiddlers;
	if (shadowTexts) {
		shadowTexts[OVERVIEW_TITLE] = "<<fileBackupsSummary>>";
		shadowTexts[CONFIG_TITLE] = [
			"File Backups reminder settings for ''this wiki''. Leave a value empty to use the global default (AddOn options in about:addons). Enter a whole number to override it; 0 turns that reminder off for this wiki. Changes apply from the next save.",
			"",
			"|remindAfterDays| |",
			"|fileCountLimit| |",
			"|sizeLimitMB| |",
			"",
			"* ''remindAfterDays'': remind me if I haven't saved a milestone in this many days",
			"* ''fileCountLimit'': remind me when the backup folder holds more than this many files",
			"* ''sizeLimitMB'': remind me when backups use more than this much disk space (MB)",
			"",
			"See [[" + OVERVIEW_TITLE + "]] for the current backups."
		].join("\n");
	}

	// --- entry points ------------------------------------------------------

	var LABEL = "save milestone";
	var PROMPT = "Save a milestone snapshot of this wiki (Alt+M)";

	root.config.macros.fileBackupsMilestone = {
		label: LABEL,
		prompt: PROMPT,
		handler: function (place, macroName, params) {
			if (root.readOnly) return;
			root.createTiddlyButton(place, params[0] || this.label, params[1] || this.prompt, function () {
				openModal();
				return false;
			});
		}
	};

	// Sidebar: after <<saveChanges>> in the shadow. A customised (real)
	// SideBarOptions tiddler is left alone — backstage + Alt+M still work.
	var shadows = root.config.shadowTiddlers;
	if (shadows && typeof shadows.SideBarOptions === "string" &&
		shadows.SideBarOptions.indexOf("<<fileBackupsMilestone>>") === -1) {
		shadows.SideBarOptions = shadows.SideBarOptions.replace("<<saveChanges>>", "<<saveChanges>><<fileBackupsMilestone>>");
	}

	// Backstage task. backstage.init() reads config.backstageTasks in main(),
	// so this shows up when we're injected before main() (normal page load).
	if (root.config.tasks && root.config.backstageTasks &&
		root.config.backstageTasks.indexOf("fileBackupsMilestone") === -1) {
		root.config.tasks.fileBackupsMilestone = {
			text: "milestone",
			tooltip: PROMPT,
			action: openModal
		};
		var at = root.config.backstageTasks.indexOf("save");
		root.config.backstageTasks.splice(at === -1 ? 0 : at + 1, 0, "fileBackupsMilestone");
	}
	// Backstage "backups": opens the FileBackups overview tiddler (not a modal).
	if (root.config.tasks && root.config.backstageTasks &&
		root.config.backstageTasks.indexOf("fileBackupsOverview") === -1) {
		root.config.tasks.fileBackupsOverview = {
			text: "backups",
			tooltip: "This wiki's backups and reminder settings",
			action: function () { root.story.displayTiddler(null, OVERVIEW_TITLE); }
		};
		var at2 = root.config.backstageTasks.indexOf("fileBackupsMilestone");
		root.config.backstageTasks.splice(at2 === -1 ? 0 : at2 + 1, 0, "fileBackupsOverview");
	}

	// Alt+M, like TW5's $:/config/shortcuts/save-milestone. Use e.code so it
	// also works on layouts where Alt+M types a character (macOS: "µ").
	document.addEventListener("keydown", function (e) {
		if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === "KeyM") {
			if (root.readOnly) return;
			e.preventDefault();
			openModal();
		}
	}, true);

	// Injected after main() already rendered the page (extension installed or
	// reloaded while the wiki was open): redraw so the sidebar button appears.
	if (root.store && typeof root.refreshDisplay === "function") {
		try {
			root.refreshDisplay(["SideBarOptions"]);
		} catch (err) {}
	}
})(typeof window !== "undefined" ? window : this);
