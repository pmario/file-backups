"use strict";

const BACKUP_DIR = "twBackups";

// At the moment it always returns win32
// startup() function needs to fix this
const tempPath = require("../libs/path");
const actions = require("./page-actions");

var path;


function getOsInfo(cb) {
	browser.runtime.getPlatformInfo().then((info) => {
		cb(info);
	})
};


getOsInfo((info) => {
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
	var char = "a";
	var cnt = count - max;

	if (count <= max) {
		char = String.fromCharCode(64 + count);
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
			backupEnabled = items.backupEnabled || false,
			backupdir = items.backupdir || BACKUP_DIR,
			max = items.numberOfBackups || 5,
			nextChar = getNextChar(counter, max);

		// imo this won't happen, but who knows.
		if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

		if (backupEnabled) {
			//            var bkdate = (new Date()).toISOString().slice(0,10);
			var pathX = path.parse(message.path);
			var nameX = path.join(message.subdir, backupdir, pathX.base, pathX.name + "(" + nextChar + ")" + pathX.ext);

			itemid = await browser.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
				filename: nameX,
				conflictAction: "overwrite"
			})

			if (itemId) {
				results = await browser.downloads.search({id: itemId});
				if (results) {
					var a = a
				}
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

async function downloadWiki(message) {
	let test,
		itemId,
		results,
		response;

	test = path.join(message.subdir, path.basename(message.path));

	// needed, for a roundtrip, to set up the right save directory.
	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([message.txt], { type: "text/plain"})),
		filename: path.join(message.subdir, path.basename(message.path)),
		conflictAction: "overwrite"
	});

	if (itemId) {
		results = await browser.downloads.search({id: itemId});
	}

	if (results) {
		// check relative path
		//console.log(results);
/* done outside
		sendResponse({
			relPath: message.subdir
		});
*/
		// Create a backup
		await createBackup(message);
	}

	response = message.subdir;
	return response;
}

async function downloadDialog(message) {
	let itemId,
		results;

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

		await prepareAndOpenNewTab(results[0]);
	}
	return true;
}

async function download2Clicks(message) {
	var itemId,
		results,
		savedAs,
		returnPath;

	itemId = await browser.downloads.download({
		url: URL.createObjectURL(new Blob([message.txt], {type: "text/plain"})),
		//filename: path.basename(message.path),
		filename: "temp(x).html",
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
		// check relative path
		//console.log(results);

		if (path.isAbsolute(relPath)) rejectPath = true;

		let y = relPath.split(path.sep);

		savedAs = path.parse(results[0].filename);
		y.shift(); // remove the ".."

		if (y[0] === ".." || rejectPath) {
			returnPath = ""; // problem .. path not valid
		} else {
			returnPath = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
		}

		// save the subdir info
		let items = await browser.storage.local.get();

		if (items) {
			let stash = new Facet(items[message.path]) || {};

			// Save config
			browser.storage.local.set({
				defaultDir: defaultDir,
			[message.path]: new Facet(stash, {subdir: returnPath})
			});
		} // if items

		// TODO should be obsolete now
		notify(savedAs, y);

	} // if results

	return returnPath;
}

function timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function prepareAndOpenNewTab(dlInfo) {
	let items = await browser.storage.local.get();
	let stash = new Facet(items[dlInfo.filename]) || {};
	let filename = dlInfo.filename;

	let elem = path.parse(dlInfo.filename);
	elem.base = "";
	elem.name = "";
	elem.ext = "";
	let newDir = path.format(elem);

	let rel = path.relative(items.defaultDir, newDir);

	if (rel === "") {
		rel = "." + path.sep;
	}

	await browser.storage.local.set({
		[dlInfo.filename]: new Facet(stash, {subdir: rel})
	});

	//TDOO remove this hack!!!
	await timeout(1000);

	browser.tabs.create({
		active: true,
		url: filename
	});
}

function notify(savedAs, relPath) {
	browser.notifications.create({
		"type": "basic",
		"title": "Your file has been saved to the default 'Downloads' directory!",
		"message": `Name: ` + savedAs.name + savedAs.ext + "-> Save Again!!"
	});
}

async function handleSaveWiki(message) {
	let allowBackup = false,
		test = path.parse(message.path),
		rel = path.relative(path.parse(message.path).dir, "Downloads"),
		response;

	var items = await browser.storage.local.get();

	if (items) {
		let stash = new Facet(items[message.path]) || {},
			subdir = stash.fields.subdir || null;

		message.subdir = (message.subdir) ? message.subdir : (subdir) ? subdir : null;

		if (message.subdir) {
			// normal download
			response = await downloadWiki(message);
		} else if (message.saveas === "yes") {
			// save dialog
			response = await downloadDialog(message);
		} else {
			// 2 click save
			response = await download2Clicks(message);
		}
	}
	// This one is important! sendResponse will be async. ContentScript expects it that way atm.
	return {relPath: response};
};

async function handleMessages(message, sender, sendResponse) {
	let response;

	if (message.msg === "updateBackupEnabled") {
		return handleUpdateTabIcon(message);
		//sendResponse({});
	}

	if (message.msg === "save-wiki") {
		return handleSaveWiki(message);
		//sendResponse({relPath: response});
	}

//	return true; // important for async response with sendResponse()
}


