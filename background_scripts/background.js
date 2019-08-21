"use strict";

const BACKUP_DIR = "twBackups";

// At the moment it always returns win32
// startup() function needs to fix this
const tempPath = require("../libs/path");

var path,
    osInfo;

function getOsInfo(cb) {
	browser.runtime.getPlatformInfo().then((info) => {
		cb(info);
	})
};

getOsInfo((info) => {
    osInfo = info;
	if (info.os === "win") {
		path = tempPath;
	} else {
		path = tempPath.posix;
	}
});

// Derived from the $tw.Tiddler() ... but simplified the structure
// Facets are used to manipulate store objects.
// usage: facet = new Facet(otherFacet, {key:value}, {});
var Facet = function ( /* [fields,] fields */ ) {
	this.id = "!§$%&";
	this.fields = Object.create(null);
	for (var c = 0; c < arguments.length; c++) {
		var arg = arguments[c] || {},
			src = (arg.id === "!§$%&") ? arg.fields : arg;
		for (var t in src) {
			if (src[t] === undefined || src[t] === null) {
				if (t in this.fields) {
					delete this.fields[t]; // If we get a field that's undefined, delete any previous field value
				}
			} else {
				var value = src[t];
				// Freeze the field to keep it immutable
				if (value != null && typeof value === "object") {
					Object.freeze(value);
				}
				this.fields[t] = value;
			}
		}
	}
	// Freeze the facet against modification
	Object.freeze(this.fields);
	Object.freeze(this);
};

//
// Background download() listener!!
// This one is needed because, the downloaded blobs need to be revoked, to be GCed
// see: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download#Return_value
//

var blobs = {};

function handleDownloadChanged(delta) {
	if (delta.state && delta.state.current === "complete") {
//		console.log(`Download ${delta.id} has completed.`, "blobs: ", blobs);

		if (delta.id in blobs) {
			URL.revokeObjectURL(blobs[delta.id]);
			delete blobs[delta.id];
		} else { // this should not happen!!
			console.log(`Download ${delta.id} not found.`, "blobs: ", blobs);
		}
	} else { // a bit of error handling
		console.log(`Download ${delta.id} was ${delta.state}.`, "blobs: ", blobs);
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
}

browser.runtime.onUpdateAvailable.addListener(handleUpdateAvailable);

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
		itemId,
		results;

	// Backup using "Tower of Hanoi" backup schema
	items = await browser.storage.local.get()

	if (items) {
		let stash = new Facet(items[message.path]) || {},
			counter = stash.fields.counter || 1,
			backupEnabled = (items.backupEnabled == undefined) ? true : items.backupEnabled,
			backupdir = items.backupdir || BACKUP_DIR,
			max = items.numberOfBackups || 7,
			nextChar = getNextChar(counter, max);

		// imo this won't happen, but who knows.
		if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

		if (backupEnabled) {
			var pathX = path.parse(message.path);
			var nameX = path.join(message.subdir, backupdir, pathX.base, pathX.name + "(" + nextChar + ")" + pathX.ext);

			var element = URL.createObjectURL(new Blob([message.txt], {type: "text/plain"}));

			itemId = await browser.downloads.download({
				url: element,
				filename: nameX,
				conflictAction: "overwrite",
				saveAs: false
			});

			if (itemId) {
				blobs[itemId] = element;
				results = await browser.downloads.search({id: itemId});
			} // if itemId

			// Store the config elements per tab.
			counter = counter + 1;

			await browser.storage.local.set({
				[message.path]: new Facet(stash, {
					counter: counter
				})
			})
		} // if backupEnabled
	} // if items
};

async function downloadWiki(message) {
	let itemId,
		results,
		response = {};


	let cnt;

	// get info from local storage.
	let items = await browser.storage.local.get(),
		stash = new Facet(items[message.path]) || {};

//	let test = path.join(message.subdir, path.basename(message.path));

	// needed, for a roundtrip, to set up the right save directory.

	var element = URL.createObjectURL(new Blob([message.txt], { type: "text/plain"}));

	itemId = await browser.downloads.download({
		url: element,
		filename: path.join(message.subdir, path.basename(message.path)),
		conflictAction: "overwrite",
		saveAs: false
	});

	if (itemId) {
		blobs[itemId] = element;
		results = await browser.downloads.search({id: itemId});
//		results = await browser.downloads.search({limit: 1, orderBy: ["-startTime"]});
	}

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

	cnt += 1;

	return response;
} // downloadWiki()

async function downloadDialog(message) {
	let itemId,
		results,
		response = {};

	var element = URL.createObjectURL(new Blob([message.txt], {type: "text/plain"}));

	itemId = await browser.downloads.download({
		url: element,
		filename: path.basename(message.path),
		conflictAction: "overwrite",
		saveAs: true
	})

	if (itemId) {
		blobs[itemId] = element;
		results = await browser.downloads.search({id: itemId});
	}

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
		savedAs,
		response = {},
		template = `This file was created by "file-backups" browser AddOn,<br/>
to find out the default position, to save your TiddlyWiki.<br/>
You can delete it if you want. It will be recreated, if needed.<br/>
`;

	var element = URL.createObjectURL(new Blob([template], {type: "text/plain"}));

	itemId = await browser.downloads.download({
		url: element,
		filename: "beakon.tmp.html",
		conflictAction: "overwrite",
		saveAs: false
	});

	// TODO remove hack
	//await timeout(500);

	if (itemId) {
		blobs[itemId] = element;
		results = await browser.downloads.search({id: itemId});
	}

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

		savedAs = path.parse(results[0].filename);
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
			let stash = new Facet(items[message.path]) || {};

			// Save config
			await browser.storage.local.set({
				defaultDir: defaultDir,
			[message.path]: new Facet(stash, {subdir: response.relPath})
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
		stash = new Facet(items[dlInfo.filename]) || {},
		filename = dlInfo.filename,
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
		[dlInfo.filename]: new Facet(stash, {subdir: rel})
	});

	//TDOO remove this hack!!!
	await timeout(1000);

	return await openNewWiki(dlInfo);
} // prepareAndOpenNewTab()

async function openNewWiki(dlInfo) {
	if (osInfo.os === "win") {
		dlInfo.filename = "file:\\\\" + dlInfo.filename;

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
	let allowBackup = false,
		test = path.parse(message.path),
		rel = path.relative(path.parse(message.path).dir, "Downloads"),
		response = {};

	var items = await browser.storage.local.get();

	if (items) {
		let stash = new Facet(items[message.path]) || {},
			subdir = stash.fields.subdir || null;

		message.subdir = (message.subdir) ? message.subdir : (subdir) ? subdir : null;

		if (message.subdir) {
			// normal download
			// everything is known, data from local storage is set.
			response = await downloadWiki(message);

			// check if browser download dir has been changed.
			if (response.relPath === "") {
				response = await downloadDialog(message);
			}
		} else if (message.saveas === "yes") {
			// save dialog
			response = await downloadDialog(message);
		} else {
			// 2 click save
			// we need to save temp(x).html to find out where the download directory is.
			// than save again
			response = await createBeakon(message);
			if (!response.relPath) {
				message.saveAs === "yes";
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


