"use strict";

const BACKUP_DIR = "twBackups";

// At the moment it always returns win32
// startup() function needs to fix this
const tempPath = require("../libs/path");
const actions = require("./page-actions");

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
				// Parse the field with the associated field module (if any)
				var value = src[t];
				// Freeze the field to keep it immutable
				if (value != null && typeof value === "object") {
					Object.freeze(value);
				}
				this.fields[t] = value;
			}
		}
	}
	// Freeze the tiddler against modification
	Object.freeze(this.fields);
	Object.freeze(this);
};

/*
When first loaded, initialize the page action for all tabs.
*/
var gettingAllTabs = browser.tabs.query({});

gettingAllTabs.then((tabs) => {
//	console.log("tabs: ", tabs);
	for (let tab of tabs) {
		actions.initializePageAction(tab);
	}
});

//
//
// Tab Actions
//
//
browser.tabs.onActivated.addListener((tab) => {
	var x = tab
	x.id = tab.tabId;

	actions.updatePageAction(x);
	//    console.log("activated:", tab)
});

/*
Each time a tab is updated, reset the page action for that tab.
*/
browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
	tab.id = id;
	actions.updatePageAction(tab);
	//  console.log("update triggered:", tab)
});

/*
Toggle CSS when the page action is clicked.
*/
browser.pageAction.onClicked.addListener((tab) => {
	actions.toggleEnableBackups(tab);
});


//
//
// Bacground main() listener!!
//
//
browser.runtime.onMessage.addListener(handleMessages);

// should be straight forward and simple.
// uses the following  construction to respond back to the contentScript:
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/runtime/onMessage#Sending_an_asynchronous_response_using_a_Promise
async function handleMessages(message, sender, sendResponse) {
	// Update tab icon, when main-popup save is clicked
	if (message.msg === "updateBackupEnabled") {
		return handleUpdateTabIcon(message);
	}

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

async function handleUpdateTabIcon(message) {
	function updateTab(tabs) {
		if (tabs.length > 0) {
			actions.messageUpdatePageAction(tabs[0], message);
		}
		return {};
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	var gettingActive = browser.tabs.query({
		currentWindow: true,
		active: true
	});
	gettingActive.then(updateTab, onError);
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
			backupEnabled = items.backupEnabled || true,
			backupdir = items.backupdir || BACKUP_DIR,
			max = items.numberOfBackups || 7,
			nextChar = getNextChar(counter, max);

		// imo this won't happen, but who knows.
		if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

		if (backupEnabled) {
			var pathX = path.parse(message.path);
			var nameX = path.join(message.subdir, backupdir, pathX.base, pathX.name + "(" + nextChar + ")" + pathX.ext);

			itemId = await browser.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
				filename: nameX,
				conflictAction: "overwrite"
			})

			if (itemId) {
				results = await browser.downloads.search({id: itemId});
			} // if itemId

			// Store the config elements per tab.
			counter = counter + 1;

			browser.storage.local.set({
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

	// get info from local storage.
	let items = await browser.storage.local.get(),
		stash = new Facet(items[message.path]) || {};

//	let test = path.join(message.subdir, path.basename(message.path));

	// needed, for a roundtrip, to set up the right save directory.
	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([message.txt], { type: "text/plain"})),
		filename: path.join(message.subdir, path.basename(message.path)),
		conflictAction: "overwrite"
	});

	if (itemId) {
		results = await browser.downloads.search({id: itemId});
	}

	// Check, if download dir is the same.
	if (!(message.path === results[0].filename)) {
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

	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
		filename: path.basename(message.path),
		conflictAction: "overwrite",
		saveAs: true
	})

	if (itemId) {
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

	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([template], {type: "text/plain"})),
		filename: "beakon.tmp.html",
		conflictAction: "overwrite"
	});

	if (itemId) {
		results = await browser.downloads.search({id: itemId});
	}

	if (results) {
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
			browser.storage.local.set({
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
		var test = await browser.tabs.create({
			active: true,
			url: dlInfo.filename
		});
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


