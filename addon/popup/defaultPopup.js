"use strict";

if (typeof browser === "undefined") {
	globalThis.browser = globalThis.chrome;
}

var backupdirNode;
var backupdirErrorNode;
var backupEnabledNode;
var amountNode;
var versionNode;
var submitButtonNode;

var chipNode;
var chipLabelNode;
var chipViewBtnNode;
var chipDismissBtnNode;
var footerInfoBtnNode;

// Captured during restore_options(); the form is "dirty" when any field
// diverges from baseline. Save Settings button toggles green to signal
// unsaved changes, gray otherwise.
var baseline = null;

const manifest = browser.runtime.getManifest();

// "Popup size" preference (settings page): "auto" (default) follows
// Firefox's default zoom (Settings → Zoom), which zooms web pages but not
// add-on popups; or a fixed 100–200 %. The applied factor is cached in
// localStorage so the popup opens at the right size without a visible
// jump; storage.local stays the source of truth.
const POPUP_SCALES = [100, 125, 150, 175, 200];
const POPUP_AUTO_MAX = 3;

function setPopupFactor(factor) {
	const f = isFinite(factor) && factor > 0 ? factor : 1;
	document.documentElement.style.setProperty("--fb-scale", String(f));
	try {
		localStorage.setItem("popupScaleFactor", String(f));
	} catch (err) {}
}

async function popupFactor(setting) {
	if (POPUP_SCALES.indexOf(Number(setting)) !== -1) return Number(setting) / 100;
	// "auto" (or anything unknown): Firefox's default zoom, never below 100 %.
	try {
		const zs = await browser.tabs.getZoomSettings();
		const z = Number(zs && zs.defaultZoomFactor);
		if (isFinite(z) && z > 0) return Math.min(Math.max(z, 1), POPUP_AUTO_MAX);
	} catch (err) {}
	return 1;
}

try {
	const cached = parseFloat(localStorage.getItem("popupScaleFactor"));
	if (isFinite(cached) && cached > 0) {
		document.documentElement.style.setProperty("--fb-scale", String(cached));
	}
} catch (err) {}
browser.storage.local.get({popupScale: "auto"})
	.then((items) => popupFactor(items.popupScale))
	.then(setPopupFactor, () => {});

// [What's New] / [View] target: the release notes of the current release.
const WHATSNEW_URL = "https://pmario.github.io/file-backups/news/latest.html";

function readForm() {
	return {
		backupdir: backupdirNode.value,
		backupEnabled: backupEnabledNode.checked,
		numberOfBackups: amountNode.valueAsNumber
	};
}

function isDirty() {
	if (!baseline) return false;
	var cur = readForm();
	for (var k in baseline) {
		if (baseline[k] !== cur[k]) return true;
	}
	return false;
}

function refreshSaveDirty() {
	submitButtonNode.classList.toggle("dirty", isDirty());
}

function refreshBackupdirValidity() {
	var msg = validateBackupDir(backupdirNode.value);
	backupdirErrorNode.textContent = msg || "";
	backupdirNode.classList.toggle("invalid", !!msg);
	submitButtonNode.disabled = !!msg;
	refreshSaveDirty();
}

// Render chip + footer button based on storage state.
//   chip       → visible only when storage.local.updateAvailable is set
//                  stable: "Update available → X.Y.Z"
//                  beta:   "What's New → X.Y.Z"
//   footer btn → always "What's New[ → X.Y.Z]" — passive link to updateAvailable.url
//                if set, else the installed-version's What's New page.
async function renderUpdateUI() {
	let state;
	try {
		state = await browser.storage.local.get({updateAvailable: null});
	} catch (err) {
		state = {updateAvailable: null};
	}

	const upd = state.updateAvailable;
	if (upd && upd.latest) {
		chipLabelNode.textContent = (upd.beta ? "What's New → " : "Update available → ") + upd.latest;
		chipNode.hidden = false;
		chipViewBtnNode.onclick = function () {
			browser.tabs.create({url: upd.url || WHATSNEW_URL});
			window.close();
		};
		chipDismissBtnNode.onclick = async function () {
			try {
				await browser.runtime.sendMessage({msg: "dismissUpdate"});
			} catch (err) {}
			chipNode.hidden = true;
			await renderUpdateUI();
		};
	} else {
		chipNode.hidden = true;
	}

	const label = upd && upd.latest ? "What's New → " + upd.latest : "What's New";
	const url = (upd && upd.url) || WHATSNEW_URL;
	footerInfoBtnNode.textContent = label;
	footerInfoBtnNode.onclick = function () {
		browser.tabs.create({url});
		window.close();
	};
}

// Local file access warning (Firefox 153+, see hasFileAccess() in background.js).
// An extension can't switch "Access local files on your computer" on itself
// (permissions.request for file:///* was tested and doesn't toggle it), so the
// popup only explains where the user turns it on. [Settings] opens the
// add-on's about:addons page as a shortcut.
async function renderFileAccessUI() {
	const node = document.getElementById("file-access-chip");
	let allowed = true;
	try {
		const res = await browser.runtime.sendMessage({msg: "getFileAccess"});
		allowed = !res || res.allowed !== false;
	} catch (err) {}
	node.hidden = allowed;
	if (allowed) return;

	document.getElementById("file-access-settings").onclick = function () {
		browser.runtime.openOptionsPage();
		window.close();
	};
}

function restore_options() {
	backupdirNode = document.getElementById("backupdir");
	backupdirErrorNode = document.getElementById("backupdir-error");
	backupEnabledNode = document.getElementById("backupenabled");
	amountNode = document.getElementById("amount");
	versionNode = document.getElementById("version");
	submitButtonNode = document.querySelector("#backup-form button[type='submit']");

	chipNode = document.getElementById("update-chip");
	chipLabelNode = document.getElementById("update-chip-label");
	chipViewBtnNode = document.getElementById("update-chip-view");
	chipDismissBtnNode = document.getElementById("update-chip-dismiss");
	footerInfoBtnNode = document.getElementById("footer-info-btn");

	versionNode.textContent = "V" + manifest.version;

	backupdirNode.addEventListener("input", refreshBackupdirValidity);
	backupEnabledNode.addEventListener("change", refreshSaveDirty);
	amountNode.addEventListener("input", refreshSaveDirty);

	function onError(err) {
		console.log("storage.local.get error:", err);
	}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir;
		backupEnabledNode.checked = items.backupEnabled;
		amountNode.value = items.numberOfBackups;
		baseline = readForm();
		refreshBackupdirValidity();
	}

	let gettingItem = browser.storage.local.get({
		backupdir: "twBackups",
		backupEnabled: true,
		numberOfBackups: 9
	});
	gettingItem.then(onGotStore, onError);

	// Initial render of the update chip + footer button from cached storage.
	renderUpdateUI();

	// Warn if Firefox 153+ "Access local files" is off. Also refresh the badge,
	// since the about:addons toggle may not fire permissions.onAdded.
	renderFileAccessUI();
	browser.runtime.sendMessage({msg: "refreshBadge"}).catch(() => {});

	// Trigger an auto-check (silent, throttled). If it produces a new
	// updateAvailable, the next popup open will pick it up — we don't redraw
	// here mid-paint to avoid the chip flickering in after the popup is shown.
	browser.runtime.sendMessage({msg: "checkForUpdate"}).catch(() => {});
}

document.addEventListener("DOMContentLoaded", restore_options);

document.getElementById("backup-form").addEventListener("submit", async (e) => {
	e.preventDefault();
	if (validateBackupDir(backupdirNode.value)) return; // belt-and-braces — button is already disabled
	try {
		await browser.storage.local.set({
			backupdir: backupdirNode.value,
			backupEnabled: backupEnabledNode.checked,
			numberOfBackups: amountNode.valueAsNumber
		});
		// Re-evaluate the badge instead of clearing it directly. If the "!"
		// (backupdir invalid) signal goes away but updateAvailable is still
		// set, the badge downgrades to "↻" rather than disappearing entirely.
		try {
			await browser.runtime.sendMessage({msg: "refreshBadge"});
		} catch (err) {}
	} finally {
		window.close();
	}
}, false);
