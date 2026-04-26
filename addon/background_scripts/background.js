"use strict";

// Chromium service worker reaches this file via `background.service_worker` in
// manifest.json and needs path.js imported explicitly. Firefox's event page
// reaches it via `background.scripts`, which already loaded path.js first -
// so the guard skips the import there.
if (typeof pathLib === "undefined") {
	// eslint-disable-next-line no-undef
	importScripts("/libs/path.js");
}
if (typeof validateBackupDir === "undefined") {
	// eslint-disable-next-line no-undef
	importScripts("/libs/validate.js");
}
if (typeof compareVersions === "undefined") {
	// eslint-disable-next-line no-undef
	importScripts("/libs/compare-versions.js");
}

// `browser.*` is native in Firefox; Chromium only exposes `chrome.*`. The two
// APIs are compatible at the call sites we use (promise-returning) since MV3.
if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

const BACKUP_DIR = "twBackups";

// Active update-check (file-backups-fs1). The extension fetches a small JSON
// from pmario.github.io describing the latest released version. host_permissions
// in manifest.json is scoped to that one origin. AMO's runtime.onUpdateAvailable
// is the parallel signal for AMO-installed users; both feed the same
// storage.local.updateAvailable shape so the popup chip handles both uniformly.
const VERSION_URL = "https://pmario.github.io/file-backups/version.json";
const WHATSNEW_BASE_URL = "https://pmario.github.io/file-backups/whatsnew";
const UPDATE_CHECK_THROTTLE_MS = 12 * 60 * 60 * 1000; // 12h between automatic checks

// Build the What's New URL for an installed version: "0.10.0-beta.1" → "<base>/0-10.html".
// Used as the [What's New] footer link target when no update is currently
// flagged (i.e. the user is on the latest version, or auto-check has not run
// yet). When an update IS flagged, version.json's `url` field takes precedence.
function whatsNewUrlForVersion(version) {
	const cleaned = String(version || "").trim().replace(/^v/i, "").split("+")[0].split("-")[0];
	const parts = cleaned.split(".");
	const major = parts[0] || "0";
	const minor = parts[1] || "0";
	return WHATSNEW_BASE_URL + "/" + major + "-" + minor + ".html";
}

var path,
	osInfo;

function getOsInfo(cb) {
	browser.runtime.getPlatformInfo().then((info) => {
		cb(info);
	});
}

getOsInfo((info) => {
	osInfo = info;
	path = (info.os === "win") ? pathLib.win32 : pathLib.posix;
});

// Per-wiki entries in browser.storage.local are plain {counter, subdir, ...}
// objects. Earlier versions wrapped them as Facet instances ({id, fields}),
// so unwrapStash handles the legacy shape transparently.
function unwrapStash(stored) {
	if (!stored) return {};
	if (stored.id === "!§$%&" && stored.fields) return Object.assign({}, stored.fields);
	return Object.assign({}, stored);
}

//
// Background download() listener!!
// This one is needed because, the downloaded blobs need to be revoked, to be GCed
// see: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download#Return_value
//

var blobs = {};

// Revoke the blob URL when the download reaches any terminal state
// (complete or interrupted). onChanged also fires for downloads that are
// not ours — the map lookup below is the filter.
function handleDownloadChanged(delta) {
	if (!delta.state) return;

	
	const state = delta.state.current;
	if (state !== "complete" && state !== "interrupted") return;
	if (delta.id in blobs) {
		URL.revokeObjectURL(blobs[delta.id]);
		delete blobs[delta.id];
// console.log("blobs should be empty", delta, blobs)
	}
}

if (!browser.downloads.onChanged.hasListener(handleDownloadChanged)) {
	browser.downloads.onChanged.addListener(handleDownloadChanged);
}

//
//
// Background main() listener!!
//
//
browser.runtime.onMessage.addListener(handleMessages);

//
//
// Background update listener!!
// see: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onUpdateAvailable
//

// AMO update path: fires only for AMO-installed extensions when AMO has a
// newer signed version. Persist via the same shape the active check uses so
// the popup chip flow handles both paths uniformly. AMO only signs stable
// releases, so beta=false here.
async function handleUpdateAvailable(details) {
	try {
		await browser.storage.local.set({
			updateAvailable: {
				latest: details.version,
				beta: false,
				url: whatsNewUrlForVersion(details.version),
				fetchedAt: Date.now(),
				source: "amo"
			}
		});
		await refreshBadge();
	} catch (err) {}
}

browser.runtime.onUpdateAvailable.addListener(handleUpdateAvailable);

// On install / update / browser start, file:// tabs that were already open
// don't have our content script attached — manifest content_scripts only
// match on navigation, not on tabs that pre-date the extension load.
// Inject explicitly. The content script's isTiddlyWiki* detection gates
// activation, and its data-message-box-creator sentinel makes re-injection
// idempotent on TW tabs that already have us.
async function activateOpenTwTabs() {
	let tabs;
	try {
		tabs = await browser.tabs.query({url: ["file:///*.html", "file:///*.htm"]});
	} catch (err) {
		return;
	}
	for (let tab of tabs) {
		try {
			await browser.scripting.executeScript({
				target: {tabId: tab.id},
				files: ["content_scripts/contentScript.js"]
			});
		} catch (err) {
			// Tabs we can't access (privileged URLs that slipped through the
			// query, tabs that closed mid-iteration, etc.) — ignore.
		}
	}
}

browser.runtime.onInstalled.addListener(activateOpenTwTabs);
browser.runtime.onStartup.addListener(activateOpenTwTabs);

// Two independent signals can raise the toolbar badge:
//   - backupdir invalid  → "!"   (downloads.download would reject; saves fail)
//   - update available   → "↻"   (AMO onUpdateAvailable, OR active check)
// They share storage.local but distinct glyphs. "!" takes priority because
// saving is broken — that's more urgent than an update notification. The
// popup's save handler messages "refreshBadge" after persisting a valid
// backupdir so the badge re-evaluates instead of being cleared blindly.
async function refreshBadge() {
	let state;
	try {
		state = await browser.storage.local.get({backupdir: "", updateAvailable: null});
	} catch (err) { return; }
	let text = "";
	if (validateBackupDir(state.backupdir)) {
		text = "!";
	} else if (state.updateAvailable) {
		text = "↻";
	}
	try {
		await browser.action.setBadgeText({text});
		await browser.action.setBadgeBackgroundColor({color: "#6600ff"});
	} catch (err) {}
}

// Fetch version.json and decide whether to flag an update.
//   - Auto-fired triggers (onInstalled, onStartup, popup-open) honour the
//     autoCheckForUpdates pref AND the 12h throttle.
//   - Manual ({force:true}) bypasses both gates; user explicitly clicked.
// Filters applied AFTER fetch:
//   - data.beta && !showBetaUpdates  → suppress (user did not opt in)
//   - data.version === dismissed     → suppress (user clicked Got it on it)
//   - compareVersions(remote,local)<=0 → suppress (we are at or ahead)
async function checkForUpdate({force = false} = {}) {
	let state;
	try {
		state = await browser.storage.local.get({
			autoCheckForUpdates: true,
			showBetaUpdates: false,
			lastUpdateCheckAt: 0,
			updateAvailable: null,
			dismissedUpdateVersion: null
		});
	} catch (err) {
		return null;
	}

	if (!force) {
		if (!state.autoCheckForUpdates) return state.updateAvailable;
		if (Date.now() - state.lastUpdateCheckAt < UPDATE_CHECK_THROTTLE_MS) {
			return state.updateAvailable;
		}
	}

	let data;
	try {
		const resp = await fetch(VERSION_URL, {cache: "no-cache"});
		if (!resp.ok) {
			// Server reachable but returned non-2xx (404/500/etc). Mark the
			// check time so we don't hammer a broken endpoint, but don't change
			// updateAvailable.
			await browser.storage.local.set({lastUpdateCheckAt: Date.now()});
			return state.updateAvailable;
		}
		data = await resp.json();
	} catch (err) {
		// Network error or invalid JSON. Don't update lastUpdateCheckAt so the
		// next trigger retries — transient failures shouldn't block notifications
		// for 12h.
		return state.updateAvailable;
	}

	await browser.storage.local.set({lastUpdateCheckAt: Date.now()});

	const remote = data && data.version;
	if (!remote) return state.updateAvailable;

	const local = browser.runtime.getManifest().version;
	if (compareVersions(remote, local) <= 0) {
		// We are at or ahead of remote. If a stale updateAvailable lingers
		// (e.g. release was rolled back), clear it.
		if (state.updateAvailable) {
			await browser.storage.local.set({updateAvailable: null});
			await refreshBadge();
		}
		return null;
	}

	if (data.beta === true && !state.showBetaUpdates) {
		return state.updateAvailable;
	}

	if (state.dismissedUpdateVersion === remote) {
		return state.updateAvailable;
	}

	const updateAvailable = {
		latest: remote,
		beta: data.beta === true,
		url: data.url || whatsNewUrlForVersion(remote),
		fetchedAt: Date.now(),
		source: "fetch"
	};
	await browser.storage.local.set({updateAvailable});
	await refreshBadge();
	return updateAvailable;
}

// Wire the auto-fired triggers. Both call checkForUpdate (which decides
// whether to actually fetch based on pref + throttle), and refreshBadge so
// any stale backupdir flag also gets re-evaluated.
async function checkOnLifecycleEvent() {
	await checkForUpdate();
	await refreshBadge();
}
browser.runtime.onInstalled.addListener(checkOnLifecycleEvent);
browser.runtime.onStartup.addListener(checkOnLifecycleEvent);

// Open an info page on uninstall asking the user to reload any open
// TiddlyWiki tabs. WebExtensions provide no in-process uninstall hook
// (management.onUninstalled fires for OTHER extensions only) — setUninstallURL
// is the one signal we get, and a static page is enough to point users at the
// $:/temp/plugins/file-backups/* clean-up step.
// browser.runtime.setUninstallURL("https://pmario.github.io/file-backups/uninstalled.html").
// TODO use uninstalled page instead of /issues (which is for testing)
browser.runtime.setUninstallURL("https://github.com/pmario/file-backups/issues").
catch(function () {});

// should be straight forward and simple.
// uses the following  construction to respond back to the contentScript:
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onMessage#Sending_an_asynchronous_response_using_a_Promise
function handleMessages(message, sender, sendResponse) {

	// Standard save-wiki message from contentScript
	if (message.msg === "save-wiki") {
		return handleSaveWiki(message);
	}

	// Check tabs, if TW file URL is open already.
	if (message.msg === "checkUrlConflict") {
		return checkUrlConflict(message);
	}

	// Popup-open trigger for the active update-check. Honours throttle + pref.
	// Returns the resulting (or pre-existing) updateAvailable object so the
	// popup can render without a second storage round-trip.
	if (message.msg === "checkForUpdate") {
		return checkForUpdate({force: false});
	}

	// Popup [Check for Update] button. Bypasses throttle + autoCheckForUpdates
	// pref; the user explicitly asked.
	if (message.msg === "checkForUpdateNow") {
		return checkForUpdate({force: true});
	}

	// Popup [Got it] dismiss. Records the latest version so we don't re-prompt
	// for the same one, clears the chip, and re-evaluates the badge (which may
	// fall back to "!" if the backupdir is also flagged, or clear entirely).
	if (message.msg === "dismissUpdate") {
		return (async () => {
			const {updateAvailable} = await browser.storage.local.get({updateAvailable: null});
			if (updateAvailable && updateAvailable.latest) {
				await browser.storage.local.set({
					dismissedUpdateVersion: updateAvailable.latest,
					updateAvailable: null
				});
				await refreshBadge();
			}
			return null;
		})();
	}

	// Popup/settings save handler triggers this after persisting a valid
	// backupdir so the "!" badge clears (or downgrades to "↻" if an update
	// is also pending).
	if (message.msg === "refreshBadge") {
		return refreshBadge();
	}
}

// Check, if there is an other tab, with the same URL open already?
async function checkUrlConflict(message) {
	var count = 0,
		tabs = await browser.tabs.query({url:"file://*/*"});

	for (let tab of tabs) {
		if (tab.url === message.url) {
			count += 1;
		}
	}
	return (count > 1);
}


/*
// The sequence can be calculated like this:
// seq = 2^set−1 + j * 2^set, j = 0, 1, 2, 3, 4

console.clear();

var max = 2;
var set = 11;

for (var j = 0; j < 12; j++) {
    var seq = Math.pow(2,set-1) + j * Math.pow(2,set);
    console.log(seq);
}
// File 11 -> seq: 1024, 3072, 5120, 7168, ...
// File 5 -> 16, 48, 80, 112, ..
*/

// Find file index, if counter is known.
function getNextChar(count, max) {
	var date = new Date();
	var char = "a";
	var cnt = count /* - max */;

// Changed with 0.3.6, since it may overwrite existing backups,
// if the AddOn is uninstalled then reinstalled, because the local storage will be deleted
// by the browser, so the counter starts over from 1, wich will cause problems.

	if (count <= 1) {
		// The first save after plugin installation will look like
		// eg: empty(2018-03-09T16-23-47-792Z).html
		char = date.toJSON().replace(/:|\./ig,"-");
	} else {
		for (var i = 0; i < max; i++) {
			if ((cnt - Math.pow(2, i)) % Math.pow(2, i + 1) === 0) {
				char = String.fromCharCode(65 + i);
				break;
			}
		}
		char = (char === "a") ? String.fromCharCode(64 + max) : char
	}
	//	console.log(char);
	return char;
}

async function createBackup(message) {
	let items,
		itemId;

	// Backup using "Tower of Hanoi" backup schema
	items = await browser.storage.local.get()

	if (items) {
		let stash = unwrapStash(items[message.path]),
			counter = stash.counter || 1,
			backupEnabled = (items.backupEnabled == undefined) ? true : items.backupEnabled,
			backupdir = items.backupdir || BACKUP_DIR,
			max = items.numberOfBackups || 9,
			nextChar = getNextChar(counter, max);

		// imo this won't happen, but who knows.
		if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

		if (backupEnabled) {
			var pathX = path.parse(message.path);
			var nameX = path.join(message.subdir, backupdir, pathX.base, pathX.name + "(" + nextChar + ")" + pathX.ext);

			var element = URL.createObjectURL(new Blob([message.txt], {type: "text/html"}));

			try {
				itemId = await browser.downloads.download({
					url: element,
					filename: nameX,
					conflictAction: "overwrite",
					saveAs: false
				});
			} catch (err) {
				URL.revokeObjectURL(element);
				throw err;
			}

			blobs[itemId] = element;

			// Store the config elements per tab.
			counter = counter + 1;

			await browser.storage.local.set({
				[message.path]: Object.assign({}, stash, {counter: counter})
			})
		} // if backupEnabled
	} // if items
};

// User-triggered milestone snapshot. Writes an extra file alongside the
// Tower-of-Hanoi rotation in the same backup directory, named
// <wiki>(<ts>[-<label>])<ext>. conflictAction "uniquify" so multiple
// milestones at the same second don't overwrite each other.
function sanitizeMilestoneLabel(raw) {
	return String(raw || "")
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

async function createMilestoneFile(message) {
	let items = await browser.storage.local.get();
	if (!items) return;
	let backupdir = items.backupdir || BACKUP_DIR;
	let pathX = path.parse(message.path);
	let label = sanitizeMilestoneLabel(message.milestoneLabel);
	let ts = String(message.milestoneTs || "");
	let stem = pathX.name + "(" + ts + ")" + (label ? "-" + label : "");
	let nameX = path.join(message.subdir, backupdir, pathX.base, stem + pathX.ext);

	let element = URL.createObjectURL(new Blob([message.txt], {type: "text/html"}));
	let itemId;
	try {
		itemId = await browser.downloads.download({
			url: element,
			filename: nameX,
			conflictAction: "uniquify",
			saveAs: false
		});
	} catch (err) {
		URL.revokeObjectURL(element);
		// Don't rethrow — main wiki save already succeeded; the milestone
		// is the optional extra. Failure is logged for diagnostics only.
		console.log("createMilestoneFile error:", err);
		return;
	}
	blobs[itemId] = element;
}

async function downloadWiki(message) {
	let itemId,
		results,
		response = {};

	// needed, for a roundtrip, to set up the right save directory.
	var element = URL.createObjectURL(new Blob([message.txt], { type: "text/html"}));

	try {
		itemId = await browser.downloads.download({
			url: element,
			filename: path.join(message.subdir, path.basename(message.path)),
			conflictAction: "overwrite",
			saveAs: false
		});
	} catch (err) {
		URL.revokeObjectURL(element);
		throw err;
	}

	blobs[itemId] = element;
	results = await browser.downloads.search({id: itemId});

	let dirA = (osInfo.os === "win") ? message.path.toLowerCase() : message.path;
	let dirB = (osInfo.os === "win") ? results[0].filename.toLowerCase() : results[0].filename;

	// Check, if download dir is the same.
	if (dirA !== dirB) {
		return {relPath: "",
				downloadWikiError: "Wrong Download Directory!",
				downloadWikiInfo: results[0]};
	}

	if (results) {
		// Create a backup
		await createBackup(message);
		// User-triggered milestone snapshot, alongside the Hanoi rotation
		if (message.milestone) {
			await createMilestoneFile(message);
		}
	}

	response.relPath = message.subdir;

	return response;
} // downloadWiki()

async function downloadDialog(message) {
	let itemId,
		results,
		response = {};

	var element = URL.createObjectURL(new Blob([message.txt], {type: "text/html"}));

	try {
		itemId = await browser.downloads.download({
			url: element,
			filename: path.basename(message.path),
			conflictAction: "overwrite",
			saveAs: true
		});
	} catch (err) {
		URL.revokeObjectURL(element);
		// Any failure here (user cancelled the Save As dialog, invalid
		// filename, disk error, etc.) must resolve the background message
		// Promise cleanly — otherwise Firefox retains the structured-cloned
		// message (containing the full wiki HTML) in the sendRuntimeMessage
		// holder indefinitely, leaking ~wikiSize of memory per cancel.
		return {relPath: "", downloadDialogError: String(err)};
	}

	blobs[itemId] = element;
	results = await browser.downloads.search({id: itemId});

	if (results) {
		// check relative path
		//console.log(results);
		response = await prepareAndOpenNewTab(results[0]);
	}
	return response;
} // downloadDialog()

async function createBeakon(message) {
	var itemId,
		results,
		response = {},
		template = `This file was created by "file-backups" browser AddOn,<br/>
to find out the default position, to save your TiddlyWiki.<br/>
You can delete it if you want. It will be recreated, if needed.<br/>
`;

	var element = URL.createObjectURL(new Blob([template], {type: "text/html"}));

	try {

		itemId = await browser.downloads.download({
			url: element,
			filename: "beakon.tmp.html",
			conflictAction: "overwrite",
			saveAs: false
		});
	} catch (err) {
		URL.revokeObjectURL(element);
		throw err;
	}

	blobs[itemId] = element;
	results = await browser.downloads.search({id: itemId});

	if (results.length > 0) {
		let rejectPath = false;
		let defaultEl = path.parse(results[0].filename);
		defaultEl.base = "";
		defaultEl.name = "";
		defaultEl.ext = "";
		let defaultDir = path.format(defaultEl);

		let relPath = path.relative(results[0].filename, path.parse(message.path).dir);

		if (path.isAbsolute(relPath)) rejectPath = true;

		let y = relPath.split(path.sep);

		y.shift(); // remove the ".."

		if (y[0] === ".." || rejectPath) {
			response.relPath = ""; // problem .. path not valid
			response.beakonError = "Path is outside browser donwload directory!";
			response.beakonInfo = results[0];
		} else {
			response.relPath = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
		}

		// save the subdir info
		let items = await browser.storage.local.get();

		if (items) {
			let stash = unwrapStash(items[message.path]);

			// Save config
			await browser.storage.local.set({
				defaultDir: defaultDir,
				[message.path]: Object.assign({}, stash, {subdir: response.relPath})
			});
		} // if items
	} // if results

	return response;
} // createBeakon()

function timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function prepareAndOpenNewTab(dlInfo) {
	let items = await browser.storage.local.get(),
		stash = unwrapStash(items[dlInfo.filename]),
		rejectPath;

	let elem = path.parse(dlInfo.filename);
	elem.base = "";
	elem.name = "";
	elem.ext = "";
	let newDir = path.format(elem);

	let rel = path.relative(items.defaultDir, newDir);
	if (path.isAbsolute(rel)) rejectPath = true;

	if (rejectPath === true) {
		rel = "";
	} else if (rel === "") { // TODO check path library, imo bug on windows!
		rel = "." + path.sep;
	}

	await browser.storage.local.set({
		[dlInfo.filename]: Object.assign({}, stash, {subdir: rel})
	});

	//TDOO remove this hack!!!
	await timeout(1000);

	return await openNewWiki(dlInfo);
} // prepareAndOpenNewTab()

async function openNewWiki(dlInfo) {
	if (osInfo.os === "win") {
		dlInfo.filename = "file:\\\\" + dlInfo.filename;

//		var test = await browser.tabs.create({
//			active: true,
//			url: dlInfo.filename
//		});

		return {relPath: "",
				openNewTabError:"Please open your Wiki at:",
				openNewTabInfo: dlInfo};
	} else {
		return {relPath: "",
				openNewTabError:"Please open your Wiki at:",
				openNewTabInfo: dlInfo};
	}
}

async function handleSaveWiki(message) {
	let response = {};

	var items = await browser.storage.local.get();

	if (items) {
		let stash = unwrapStash(items[message.path]),
			subdir = stash.subdir || null;

		message.subdir = (message.subdir) ? message.subdir : (subdir) ? subdir : null;

		// Explicit "Save As" from the user wins over everything else.
		if (message.saveas === "yes") {
			response = await downloadDialog(message);
		} else if (message.subdir) {
			// normal download
			// everything is known, data from local storage is set.
			response = await downloadWiki(message);

			// check if browser download dir has been changed.
			if (response.relPath === "") {
				response = await downloadDialog(message);
			}
		} else {
			// 2 click save
			// we need to save temp(x).html to find out where the download directory is.
			// than save again
			response = await createBeakon(message);
			if (!response.relPath) {
				message.saveas = "yes";
				response = await downloadDialog(message);
			} else {
				message.subdir = response.relPath;
				response = await downloadWiki(message);
			}
		}
	}
	// This one is important! sendResponse will be async. ContentScript expects it that way atm.
	return response; //{relPath: response};
};


