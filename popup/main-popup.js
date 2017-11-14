"use strict";

/*
const tempPath = require("../libs/path");
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
*/

var backupdirNode;
var backupEnabledNode;
var amountNode;
var counterNode;


function restore_options() {

	backupdirNode = document.getElementById("backupdir");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");
//	counterNode = document.getElementById("counter");


	function onError(items) {}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir || "twBackup";
		backupEnabledNode.checked = items.backupEnabled || false;
//		counterNode.value = items.counter || 0;
		amountNode.value = items.numberOfBackups || 5;

//		console.log("options item:", items)
	};

	let gettingItem = browser.storage.local.get();
	gettingItem.then(onGotStore, onError);
}

document.addEventListener('DOMContentLoaded', restore_options);

document.getElementById("backup-form").addEventListener("submit", (e) => {

	browser.storage.local.set( {
		backupdir: backupdirNode.value,
		backupEnabled: backupEnabledNode.checked,
		numberOfBackups : amountNode.valueAsNumber
		});

//	console.log("submit OK:", e);
	e.preventDefault();

	// TODO change to function and browser.runtime ...
	// !!!!! use storage items object structure
	chrome.runtime.sendMessage({
		msg: "updateBackupEnabled",
//		backupdir: backupdirNode.value,
		backupEnabled: backupEnabledNode.checked//,
//		counter: counterNode.valueAsNumber,
//		amount: amountNode.valueAsNumber
	});


	window.close()
}, false);

document.getElementById("form-bg").addEventListener("click", (e) => {
// TODO
});
