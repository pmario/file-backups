"use strict";

var backupdirNode;
var backupEnabledNode;
var amountNode;
var counterNode;

function restore_options() {
	backupdirNode = document.getElementById("backupdir");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");

	function onError(err) {
		console.log("storage.local.get error:", err);
	}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir || "twBackups";
		backupEnabledNode.checked = items.backupEnabled || false;
		amountNode.value = items.numberOfBackups || 5;
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

	// Inform background, that backupEnabled may have been changed.
	// It's needed for page-actions
	browser.runtime.sendMessage({
		msg: "updateBackupEnabled",
		backupEnabled: backupEnabledNode.checked//,
	});

	window.close()
}, false);

document.getElementById("form-bg").addEventListener("click", (e) => {
  var creating = browser.tabs.create({
    url:"https://pmario.github.io/file-backups"
  });
});
