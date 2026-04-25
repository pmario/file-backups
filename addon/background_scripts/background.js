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

// `browser.*` is native in Firefox; Chromium only exposes `chrome.*`. The two
// APIs are compatible at the call sites we use (promise-returning) since MV3.
if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

const BACKUP_DIR = "twBackups";

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

function handleUpdateAvailable(details) {
	console.log(details.version);
	browser.action.setBadgeText({text:"!"});
	browser.action.setBadgeBackgroundColor({color: "#6600ff"});
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

// On install / browser start, check whether the stored backupdir is one that
// downloads.download will reject (e.g. a value left over from a pre-V0.8.0
// session before the popup / settings page started validating). If so, raise
// the same "!" badge the new-version notification uses — opening the popup
// reveals the actual problem inline on the field. The badge is cleared by
// the popup/settings save handler when the user persists a valid value.
async function checkBackupdirAlert() {
	let items;
	try {
		items = await browser.storage.local.get({backupdir: ""});
	} catch (err) {
		return;
	}
	if (validateBackupDir(items.backupdir)) {
		try {
			await browser.action.setBadgeText({text: "!"});
			await browser.action.setBadgeBackgroundColor({color: "#6600ff"});
		} catch (err) {}
	}
}

browser.runtime.onInstalled.addListener(checkBackupdirAlert);
browser.runtime.onStartup.addListener(checkBackupdirAlert);

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


