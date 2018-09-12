"use strict";

var backupdirNode;
var backupEnabledNode;
var amountNode;
var counterNode;
var versionNode;

const manifest = browser.runtime.getManifest();

function restore_options() {
	backupdirNode = document.getElementById("backupdir");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");
	versionNode = document.getElementById("version");

	versionNode.textContent = "V" + manifest.version;

	function onError(err) {
		console.log("storage.local.get error:", err);
	}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir;
		backupEnabledNode.checked = items.backupEnabled;
		amountNode.value = items.numberOfBackups;
	};

//	function onGotStore(items) {
//		backupdirNode.value = items.backupdir || "twBackups";
//		backupEnabledNode.checked = items.backupEnabled || true;
//		amountNode.value = items.numberOfBackups || 7;
//	};

	let gettingItem = browser.storage.local.get({
		backupdir : "twBackups",
		backupEnabled: true,
		numberOfBackups: 7
	});
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
