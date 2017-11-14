"use strict";

const BACKUP_DIR = "twBackups";

// At the moment it always returns win32
// startup() function needs to fix this
const tempPath = require("../libs/path");
const actions = require("./page-actions");

var path;

function getOsInfo(cb) {
	chrome.runtime.getPlatformInfo(function (info) {
		cb(info);
	})
};


getOsInfo(function (info) {
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
	// getOsInfo((info)=>{console.log("info: ", info)}); // debugging only TODO remove
});


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

function createBackup(message) {
	// Backup using "Tower of Hanoi" backup schema
	chrome.storage.local.get(null, function (items) {
		var stash = new Facet(items[message.path]) || {},
			backupEnabled = items.backupEnabled || false,
			backupdir = items.backupdir || BACKUP_DIR,
			counter = stash.fields.counter || 1,
			max = stash.fields.max || 5,
			nextChar = getNextChar(counter, max);

		// imo this won't happen, but who knows.
		if (counter >= Number.MAX_SAFE_INTEGER) counter = max + 1;

		if (backupEnabled) {
			//            var bkdate = (new Date()).toISOString().slice(0,10);
			var pathX = path.parse(message.path);
			var nameX = path.join(message.subdir, backupdir, pathX.base, pathX.name + "(" + nextChar + ")" + pathX.ext);

			chrome.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {
					type: "text/plain"
				})),
				filename: nameX,
				conflictAction: "overwrite"
			}, (itemId) => {
				chrome.downloads.search({
					id: itemId
				}, (results) => {
					// ^^^^^^^^^^^^^^^^^^
					var a = a
				})
			});

			// Store the config elements per tab.
			counter = counter + 1;
			chrome.storage.local.set({
                [message.path]: new Facet(stash, {
					counter: counter
				})
			})
		}
	});
};


chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
//	console.log("bg got message!");

	function updateTab(tabs) {
		var items = {
			backupEnabled: message.backupEnabled
		};

		if (tabs.length > 0) {
			actions.messageUpdatePageAction(tabs[0], message);
		}
	}

	function onError(error) {
		console.log(`Error: ${error}`);
	}

	if (message.msg === "updateBackupEnabled") {
		var gettingActive = browser.tabs.query({
			currentWindow: true,
			active: true
		});
		gettingActive.then(updateTab, onError);
		return true;
	}


	//show the choose file dialogue when tw not under 'tiddlywikilocations'
	var allowBackup = false;
	var test = path.parse(message.path);
	var rel = path.relative(path.parse(message.path).dir, "Downloads");


	chrome.storage.local.get(null, function (items) {
		let stash = new Facet(items[message.path]) || {},
			subdir = stash.fields.subdir || null;

		message.subdir = (message.subdir) ? message.subdir : (subdir) ? subdir : null;

		if (message.subdir) {
			var test = path.join(message.subdir, path.basename(message.path));

			// needed, for a roundtrip, to set up the right save directory.
			chrome.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {
					type: "text/plain"
				})),
				filename: path.join(message.subdir, path.basename(message.path)),
				conflictAction: "overwrite"
				//            saveAs: true
			}, (itemId) => {
				chrome.downloads.search({
					id: itemId
				}, (results) => {
					// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
					// check relative path
					//console.log(results);
					sendResponse({
						relPath: message.subdir
					});

					// Create a backup
					createBackup(message);
				})
			});
		} else if (message.saveas === "yes") {
			chrome.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {
					type: "text/plain"
				})),
				filename: path.basename(message.path),
				conflictAction: "overwrite",
				saveAs: true
			}, (itemId) => {
				chrome.downloads.search({
					id: itemId
				}, (results) => {
					// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
					// check relative path
					//console.log(results);

					prepareAndOpenNewTab(results[0]);

					sendResponse({
					});
					// Create a backup
					//createBackup(message);
				})
			});
		} else {
			chrome.downloads.download({
				url: URL.createObjectURL(new Blob([message.txt], {
					type: "text/plain"
				})),
//				filename: path.basename(message.path),
				filename: "temp(x).html",
				conflictAction: "overwrite"
			}, (itemId) => {
				chrome.downloads.search({
					id: itemId
				}, (results) => {
					// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
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

					// var x = path.parse(relPath); // for debugging only TODO remove!
					var y = relPath.split(path.sep);
					var savedAs, z;

					savedAs = path.parse(results[0].filename);
					y.shift(); // remove the ".."

					if (y[0] === ".." || rejectPath) {
						z = ""; // problem .. path not valid
					} else {
						z = (y.length > 0) ? y.join(path.sep) : "." + path.sep;
					}

					sendResponse({
						relPath: z
					});

					notify(savedAs, y);

					// save the subdir info
					chrome.storage.local.get(null, (items) => {
						var stash = new Facet(items[message.path]) || {};
						chrome.storage.local.set({
							defaultDir: defaultDir,
						[message.path]: new Facet(stash, {
								subdir: z
							})
						});
					}); // chrome.storage.local.get()
				}) // chrome.downloads.search()
			}); // chrome.downloads.download()
		}
	});

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
			[dlInfo.filename]: new Facet(stash, {
				subdir: rel
			})
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

	// This one is important! sendResponse will be async. ContentScript expects it that way atm.
	return true;
});
