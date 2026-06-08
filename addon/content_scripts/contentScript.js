'use strict';

if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

const PLUGIN_NAME = "file-backups"

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
		renderReminderBanners();
		browser.storage.onChanged.addListener(function (changes, area) {
			if (area === "local" && changes.awarenessReminders) {
				renderReminderBanners();
			}
		});
	}
}

// Backup-awareness reminders (phase 3). The background writes pending reminders
// to storage.local.awarenessReminders ({milestone|count|size: value|null}); we
// render them as a dismissible banner at the top of the wiki page — the same
// "inform, never act for you" surface as backendMessage. Snooze clears the
// reminder from storage. The primary action (Save milestone / Show backups) is
// wired to the real flows in a later phase; for now it dismisses.
function renderReminderBanners() {
	browser.storage.local.get({awarenessReminders: null}).then(function (s) {
		var existing = document.getElementById("fb-reminder-banner");
		if (existing) existing.parentNode.removeChild(existing);
		var reminders = s.awarenessReminders || {};
		var allKinds = (typeof FB_REMINDER_KINDS !== "undefined") ? FB_REMINDER_KINDS : ["milestone", "count", "size"];
		var kinds = allKinds.filter(function (k) { return typeof reminders[k] === "number"; });
		if (!kinds.length) return;

		var banner = document.createElement("div");
		banner.id = "fb-reminder-banner";
		banner.style = "position:fixed; left:0; right:0; top:1em; max-width:60%; margin-left:auto; margin-right:auto; z-index:10000; background:#dbeafe; color:#0c0c0d; border:2px solid #93c5fd; padding:8px 12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:14px;";

		kinds.forEach(function (kind) {
			var msg = (typeof reminderMessage === "function") ? reminderMessage(kind, reminders[kind]) : {text: kind, action: ""};
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
			snooze.addEventListener("click", function () { clearReminder(kind); });
			row.appendChild(snooze);

			banner.appendChild(row);
		});

		document.body.appendChild(banner);
	}).catch(function () {});
}

function clearReminder(kind) {
	browser.storage.local.get({awarenessReminders: null}).then(function (s) {
		var r = s.awarenessReminders || {milestone: null, count: null, size: null};
		r[kind] = null;
		return browser.storage.local.set({awarenessReminders: r});
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
			milestoneTs = message.parentNode.getAttribute("data-file-backups-milestone-ts");

		// Save the file
		saveFile(path, content, subdir, backupdir, saveas, milestone, milestoneLabel, milestoneTs, cb);

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

	// Dev test affordance (beta builds only): forward the reminder injection to
	// the background, which writes a pending reminder to storage.local. The
	// storage.onChanged listener (set up in main) then renders the banner.
	messageBox.addEventListener("file-backups-test-inject-reminder", function (e) {
		var kind = e && e.detail && e.detail.kind;
		if (kind !== "milestone" && kind !== "count" && kind !== "size" && kind !== "clear") return;
		browser.runtime.sendMessage({msg: "testInjectReminder", kind: kind})
			.catch(function () {});
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

	// Inject the TW5 page-context bridge now that the messagebox and our save
	// listener are in place. The bridge attaches a capture-phase listener on
	// the same element so it runs before the one above.
	if (isTiddlyWiki5File(doc)) {
		injectPageScript(doc, 'tw5-bridge.js');
	}
}

function saveFile(filePath, content, subdir, backupdir, saveas, milestone, milestoneLabel, milestoneTs, cb) {
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
