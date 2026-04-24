"use strict";

if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

var backupdirNode;
var backupEnabledNode;
var amountNode;
var versionNode;
var siteButtonNode;
var okButtonNode;

const manifest = browser.runtime.getManifest();

var NEWURL;

function onBadgeError(err) {
	console.log("getBadgeText error:", err);
}

function showNewVersion(text) {
	if (text) {
		siteButtonNode.innerText = "New Version Available?";
		siteButtonNode.setAttribute("class","panel-section-footer-button new-version");
		okButtonNode.innerText = "Got It!";
		NEWURL = "https://pmario.github.io/file-backups/news/latest"
	} else {
		siteButtonNode.innerText = "Homepage & Support";
		siteButtonNode.setAttribute("class","panel-section-footer-button");
		okButtonNode.innerText = "!";
		NEWURL = "https://pmario.github.io/file-backups"
	}
}

function restore_options() {
	backupdirNode = document.getElementById("backupdir");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");
	versionNode = document.getElementById("version");
	siteButtonNode = document.getElementById("form-bg");
	okButtonNode = document.getElementById("form-ok");

	versionNode.textContent = "V" + manifest.version;

	NEWURL = "https://pmario.github.io/file-backups";

	
	function onError(err) {
		console.log("storage.local.get error:", err);
	}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir;
		backupEnabledNode.checked = items.backupEnabled;
		amountNode.value = items.numberOfBackups;
	};

	function onGotBadge(text) {
		showNewVersion(text);
//		if (!text) browser.action.setBadgeText({text: "!"})
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
	
	let getBadge = browser.action.getBadgeText({});
	getBadge.then(onGotBadge, onBadgeError)
}

document.addEventListener('DOMContentLoaded', restore_options);


document.getElementById("backup-form").addEventListener("submit", async (e) => {
	e.preventDefault();
	try {
		await browser.storage.local.set({
			backupdir: backupdirNode.value,
			backupEnabled: backupEnabledNode.checked,
			numberOfBackups: amountNode.valueAsNumber
		});
	} finally {
		window.close();
	}
}, false);

document.getElementById("form-ok").addEventListener("click", (e) => {
	let getBadge = browser.action.getBadgeText({});
	getBadge.then((text) => {
		if (!text) {
			browser.action.setBadgeText({text: "!"});
			browser.action.setBadgeBackgroundColor({color: "#6600ff"});
			showNewVersion("!");
		}
		else {
			browser.action.setBadgeText({text: ""})
			showNewVersion("");
		}
	}, onBadgeError)
	
//	console.log("submit OK:", e);
	e.preventDefault();
	e.stopPropagation();
//	window.close()
}, false);


document.getElementById("form-bg").addEventListener("click", (e) => {
	var creating = browser.tabs.create({
		url: NEWURL
	});
	window.close()
});
