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

const manifest = browser.runtime.getManifest();

const WHATSNEW_BASE = "https://pmario.github.io/file-backups/whatsnew";

// Build the per-minor What's New URL for the installed version. Same shape as
// background.js's whatsNewUrlForVersion. Used by the [What's New] footer link
// when no live updateAvailable is set.
function whatsNewUrlForInstalledVersion() {
	const cleaned = String(manifest.version || "").trim().replace(/^v/i, "").split("+")[0].split("-")[0];
	const parts = cleaned.split(".");
	const major = parts[0] || "0";
	const minor = parts[1] || "0";
	return WHATSNEW_BASE + "/" + major + "-" + minor + ".html";
}

function refreshBackupdirValidity() {
	var msg = validateBackupDir(backupdirNode.value);
	backupdirErrorNode.textContent = msg || "";
	backupdirNode.classList.toggle("invalid", !!msg);
	submitButtonNode.disabled = !!msg;
}

// Render chip + footer button based on storage state.
//   chip       → visible only when storage.local.updateAvailable is set
//                  stable: "Update available → X.Y.Z"
//                  beta:   "What's New → X.Y.Z"
//   footer btn → autoCheckForUpdates=false → "Check for Update" (manual trigger)
//                autoCheckForUpdates=true  → "What's New[ → X.Y.Z]" (passive link)
async function renderUpdateUI() {
	let state;
	try {
		state = await browser.storage.local.get({
			autoCheckForUpdates: true,
			updateAvailable: null
		});
	} catch (err) {
		state = {autoCheckForUpdates: true, updateAvailable: null};
	}

	const upd = state.updateAvailable;
	if (upd && upd.latest) {
		chipLabelNode.textContent = (upd.beta ? "What's New → " : "Update available → ") + upd.latest;
		chipNode.hidden = false;
		chipViewBtnNode.onclick = function () {
			browser.tabs.create({url: upd.url || whatsNewUrlForInstalledVersion()});
			window.close();
		};
		chipDismissBtnNode.onclick = async function () {
			try {
				await browser.runtime.sendMessage({msg: "dismissUpdate"});
			} catch (err) {}
			chipNode.hidden = true;
			// Re-render the footer button — it may now read "What's New" without
			// the version suffix because updateAvailable just got cleared.
			await renderUpdateUI();
		};
	} else {
		chipNode.hidden = true;
	}

	if (state.autoCheckForUpdates) {
		const label = upd && upd.latest ? "What's New → " + upd.latest : "What's New";
		const url = (upd && upd.url) || whatsNewUrlForInstalledVersion();
		footerInfoBtnNode.textContent = label;
		footerInfoBtnNode.disabled = false;
		footerInfoBtnNode.onclick = function () {
			browser.tabs.create({url});
			window.close();
		};
	} else {
		footerInfoBtnNode.textContent = "Check for Update";
		footerInfoBtnNode.disabled = false;
		footerInfoBtnNode.onclick = onCheckForUpdateClick;
	}
}

async function onCheckForUpdateClick() {
	const original = footerInfoBtnNode.textContent;
	footerInfoBtnNode.textContent = "Checking…";
	footerInfoBtnNode.disabled = true;
	try {
		await browser.runtime.sendMessage({msg: "checkForUpdateNow"});
	} catch (err) {
		// Silent fail — fetch errors are already handled in background.
	}
	// Restore (or re-render to "What's New" if a result came in — though
	// autoCheckForUpdates is false here so the button stays "Check for Update".
	// renderUpdateUI() also redraws the chip if updateAvailable was set.)
	footerInfoBtnNode.disabled = false;
	footerInfoBtnNode.textContent = original;
	await renderUpdateUI();
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

	function onError(err) {
		console.log("storage.local.get error:", err);
	}

	function onGotStore(items) {
		backupdirNode.value = items.backupdir;
		backupEnabledNode.checked = items.backupEnabled;
		amountNode.value = items.numberOfBackups;
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
